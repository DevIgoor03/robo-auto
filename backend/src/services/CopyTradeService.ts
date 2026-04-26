import {
  Position, BalanceType,
  BlitzOptionsDirection, TurboOptionsDirection,
} from '@quadcode-tech/client-sdk-js';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { accountService } from './AccountService.js';
import { FollowerAccount } from '../types.js';

// closeReason values from the Bullex server
function isWinReason(r: string):    boolean { return r.toLowerCase() === 'win'; }
function isClosedReason(r: string | undefined): boolean {
  if (!r) return false;
  const l = r.toLowerCase();
  return ['win', 'loss', 'loose', 'expired', 'manual', 'manual-close', 'cancel'].includes(l);
}

export class CopyTradeService {
  // Each masterId maps to a Symbol that identifies the current run.
  // Old callbacks check their token against the current one and bail if stale.
  private runTokens      = new Map<string, symbol>();
  private knownPositions = new Map<string, Set<number>>();
  private copyLocks      = new Set<string>();
  // Track which followers already have a position subscription so we subscribe only once.
  private followerPositionSubscribed = new Set<string>();
  private io: SocketServer | null = null;

  setSocketServer(io: SocketServer): void { this.io = io; }

  private emit(room: string, event: string, data: unknown): void {
    this.io?.to(room).emit(event, data);
  }

  private _resolveActiveName(active: any, fallback: string): string {
    return active?.name
      ?? active?.ticker
      ?? active?.symbol
      ?? active?.asset
      ?? fallback;
  }

  /**
   * Escolhe o timeframe (segundos) disponível no ativo mais próximo do período do master.
   * Evita cair sempre em expirationTimes[0] quando a duração do master (ex.: 120s) não está na lista exata.
   */
  private _closestAllowedExpirationSec(allowed: number[], targetSecs: number): number {
    const t = Math.max(1, Math.round(targetSecs));
    if (allowed.length === 0) return t;
    return allowed.reduce((best, cur) =>
      Math.abs(cur - t) < Math.abs(best - t) ? cur : best
    , allowed[0]);
  }

  isRunning(masterId: string): boolean {
    return this.runTokens.has(masterId);
  }

  async start(masterId: string): Promise<void> {
    if (this.runTokens.has(masterId)) {
      logger.warn({ masterId }, 'CopyTrade already running — stopping previous session first');
      await this.stop(masterId);
    }

    const facade = await accountService.getOrInitMasterPositions(masterId);
    if (!facade) throw new Error('Posições do master não inicializadas. Conecte a conta Bullex primeiro.');
    await accountService.ensureMasterSessionsForToday(masterId);

    // Log active followers at start time for diagnosis
    const activeFollowers = accountService.getActiveFollowers(masterId);
    const allFollowers    = accountService.getAllFollowers(masterId);
    logger.info(
      {
        masterId,
        activeCount: activeFollowers.length,
        totalCount:  allFollowers.length,
        active: activeFollowers.map((f) => ({ id: f.id, name: f.name, isActive: f.copySettings.isActive, accountType: f.copySettings.accountType })),
        inactive: allFollowers.filter((f) => !f.copySettings.isActive).map((f) => ({ id: f.id, name: f.name })),
      },
      '▶ CopyTrade starting — follower summary'
    );

    if (activeFollowers.length === 0) {
      logger.warn({ masterId }, '⚠️  No active followers — trades will NOT be copied. Check isActive flag for followers.');
    }

    // Each run gets a unique token — old callbacks become no-ops immediately
    const sessionToken = Symbol('copy-session');
    this.runTokens.set(masterId, sessionToken);
    const sessionStartedAtMs = Date.now();

    const known = new Set<number>();
    this.knownPositions.set(masterId, known);

    // Snapshot positions currently open so we don't copy them on startup
    const openNow = facade.getOpenedPositions();
    openNow.forEach((p) => { if (p.externalId !== undefined) known.add(p.externalId); });
    logger.info({ masterId, snapshotSize: known.size }, '▶ CopyTrade started — existing positions snapped');

    await prisma.masterAccount.update({ where: { id: masterId }, data: { copyRunning: true } });
    this.emit(`master:${masterId}`, 'copy:started', { running: true });

    facade.subscribeOnUpdatePosition(async (position: Position) => {
      // If this masterId has a new token, this callback belongs to a past session → ignore
      if (this.runTokens.get(masterId) !== sessionToken) return;

      const posId = position.externalId;
      if (posId === undefined) return;

      const iType  = position.instrumentType ?? '';
      const isCopy = iType === 'blitz-option' || iType === 'turbo-option';

      if (!known.has(posId)) {
        known.add(posId);

        // Guardrail: ignore replayed/history entries that are already closed.
        if (isClosedReason(position.closeReason)) {
          logger.debug(
            { masterId, posId, closeReason: position.closeReason },
            'Ignoring replayed closed position on first sight'
          );
          return;
        }

        // Guardrail: ignore old positions emitted by SDK replay after copy/start.
        if (position.openTime && position.openTime.getTime() < sessionStartedAtMs - 2_000) {
          logger.debug(
            { masterId, posId, openedAt: position.openTime.toISOString() },
            'Ignoring historical position emitted after copy/start'
          );
          return;
        }

        if (isCopy) {
          logger.info({ masterId, posId, iType, direction: position.direction, invest: position.invest },
            '📈 New master position — copying to followers');
          this._replicatePosition(masterId, position).catch((err) =>
            logger.error({ err: err.message, masterId, posId }, 'Error replicating')
          );
        }
        return;
      }

      if (isClosedReason(position.closeReason)) {
        logger.info({ masterId, posId, closeReason: position.closeReason }, '🏁 Master position closed');
        this._resolveTrades(masterId, posId, position.closeReason!).catch((err) =>
          logger.error({ err: err.message, masterId, posId }, 'Error resolving trades')
        );
      }
    });
  }

  async stop(masterId: string): Promise<void> {
    // Invalidate the current session token — all pending callbacks become no-ops
    this.runTokens.delete(masterId);
    this.knownPositions.delete(masterId);

    // Clear follower subscription tracking so next start re-subscribes with fresh facades
    const followers = accountService.getAllFollowers(masterId);
    followers.forEach((f) => this.followerPositionSubscribed.delete(f.id));

    await prisma.masterAccount.update({ where: { id: masterId }, data: { copyRunning: false } });
    this.emit(`master:${masterId}`, 'copy:stopped', { running: false });
    logger.info({ masterId }, '⏹ CopyTrade stopped');
  }

  // ─── Replicate to all active followers ───────────────────────────────────────

  private async _replicatePosition(masterId: string, masterPos: Position): Promise<void> {
    const followers = accountService.getActiveFollowers(masterId);
    logger.info(
      { masterId, posId: masterPos.externalId, iType: masterPos.instrumentType, activeFollowers: followers.length, followerIds: followers.map((f) => f.id) },
      '📋 Replicating position to followers (parallel)'
    );

    if (followers.length === 0) {
      const all = accountService.getAllFollowers(masterId);
      logger.warn(
        { masterId, totalFollowers: all.length, statuses: all.map((f) => ({ id: f.id, name: f.name, isActive: f.copySettings.isActive })) },
        '⚠️  No active followers to copy to'
      );
      return;
    }

    // Todos os seguidores ativos ao mesmo tempo (sem ondas nem delay por plano).
    await Promise.allSettled(
      followers.map((f) =>
        this._copyToFollower(masterId, f, masterPos).catch((err) =>
          logger.error({ err: err.message, followerId: f.id }, 'Copy to follower failed')
        )
      )
    );
  }

  private async _copyToFollower(masterId: string, follower: FollowerAccount, masterPos: Position): Promise<void> {
    const masterPositionId = String(masterPos.externalId ?? '');
    const copyLockKey = `${masterId}:${follower.id}:${masterPositionId}`;
    if (this.copyLocks.has(copyLockKey)) {
      logger.debug({ masterId, followerId: follower.id, masterPositionId }, 'Copy skipped: lock already active');
      return;
    }
    this.copyLocks.add(copyLockKey);

    try {
      // Idempotency guard: never duplicate copy for same master position + follower.
      const existing = await prisma.trade.findFirst({
        where: { masterId, followerId: follower.id, masterPositionId },
        select: { id: true, status: true },
      });
      if (existing) {
        logger.warn(
          { masterId, followerId: follower.id, masterPositionId, existingTradeId: existing.id, existingStatus: existing.status },
          'Copy skipped: trade already exists for this master position'
        );
        return;
      }

    const sdk = accountService.getFollowerSdk(follower.id);
    if (!sdk) { logger.warn({ followerId: follower.id }, 'Follower SDK not found'); return; }

    const amount  = this._calcAmount(follower, masterPos);
    const iType   = masterPos.instrumentType ?? '';
    const isBlitz = iType === 'blitz-option';
    const isTurbo = iType === 'turbo-option';
    if (!isBlitz && !isTurbo) return;

    // Get follower's correct balance SDK object
    const balances   = await sdk.balances();
    const allBals    = balances.getBalances();
    const wantedType = follower.copySettings.accountType === 'real' ? BalanceType.Real : BalanceType.Demo;

    // Fallback: if real balance not found (marketing/tournament/promo accounts have type=undefined),
    // use the first non-Demo balance available.
    const balance = allBals.find((b) => b.type === wantedType)
      ?? (wantedType === BalanceType.Real ? allBals.find((b) => b.type === undefined) : null);

    if (!balance) {
      logger.warn(
        { followerId: follower.id, wantedType, available: allBals.map((b) => ({ id: b.id, type: b.type, amount: b.amount })) },
        'Balance not found for follower — check account type configuration'
      );
      return;
    }

    // Start with best effort from master position.
    // This may still be generic for some instruments, so we may overwrite it
    // with the follower-side active name returned by _openBlitz/_openTurbo.
    let activeName = this._resolveActiveName(masterPos.active as any, iType);

    let positionId: number | undefined;
    let openedOk = false;

    try {
      if (isBlitz) {
        const opened = await this._openBlitz(sdk, masterPos, amount, balance, follower.id);
        positionId = opened.positionId;
        activeName = opened.activeName ?? activeName;
      } else {
        const opened = await this._openTurbo(sdk, masterPos, amount, balance, follower.id);
        positionId = opened.positionId;
        activeName = opened.activeName ?? activeName;
      }
      openedOk = positionId !== undefined;
    } catch (err: any) {
      logger.error({ err: err.message, followerId: follower.id }, '❌ Failed to open follower position');
    }

    if (!openedOk) return;

    const trade = await prisma.trade.create({
      data: {
        masterId,
        followerId:       follower.id,
        followerName:     follower.name,
        masterPositionId,
        positionId:       String(positionId),
        amount,
        direction:        (masterPos.direction ?? 'call').toLowerCase(),
        instrumentName:   activeName,
        status:           'OPEN',
        openedAt:         new Date(),
      },
    });

    // Emit to dashboard + portal do seguidor (tempo real)
    this.emit(`master:${masterId}`, 'trade:new', trade);
    this.emit(`follower:${follower.id}`, 'trade:new', trade);
    logger.info({ followerId: follower.id, positionId, amount, activeName }, '✅ Trade copied');

    // Subscribe to this follower's own positions so resolution uses their actual result.
    // This prevents premature WIN and draw-shown-as-WIN bugs.
    this._ensureFollowerPositionSubscription(masterId, follower.id).catch((err) =>
      logger.warn({ err: err.message, followerId: follower.id }, 'Could not setup follower position subscription')
    );
    } finally {
      this.copyLocks.delete(copyLockKey);
    }
  }

  private async _openBlitz(
    sdk: any,
    masterPos: Position,
    amount: number,
    balance: any,
    followerId: string
  ): Promise<{ positionId?: number; activeName?: string }> {
    const blitz   = await sdk.blitzOptions();
    const actives = blitz.getActives() as any[];

    const active = actives.find((a: any) => a.id === masterPos.activeId && !a.isSuspended)
      ?? actives.find((a: any) => !a.isSuspended);
    if (!active) throw new Error('No available blitz active');
    const activeName = this._resolveActiveName(active, masterPos.instrumentType ?? 'blitz-option');

    const masterExpSecs = masterPos.expirationTime && masterPos.openTime
      ? Math.round((masterPos.expirationTime.getTime() - masterPos.openTime.getTime()) / 1000)
      : 30;

    const times: number[] = active.expirationTimes ?? [30, 60];
    const expSize = this._closestAllowedExpirationSec(times, masterExpSecs);

    const dir = (masterPos.direction ?? '').toLowerCase() === 'put'
      ? BlitzOptionsDirection.Put : BlitzOptionsDirection.Call;

    logger.debug(
      { followerId, activeId: active.id, masterExpSecs, allowedTimes: times, chosenExpSec: expSize, dir, amount },
      'Opening blitz position...'
    );
    const option = await blitz.buy(active, dir, expSize, amount, balance);
    return { positionId: option.id, activeName };
  }

  private async _openTurbo(
    sdk: any,
    masterPos: Position,
    amount: number,
    balance: any,
    followerId: string
  ): Promise<{ positionId?: number; activeName?: string }> {
    const turbo   = await sdk.turboOptions();
    const actives = turbo.getActives() as any[];

    const active = actives.find((a: any) => a.id === masterPos.activeId) ?? actives[0];
    if (!active) throw new Error('No available turbo active');
    const activeName = this._resolveActiveName(active, masterPos.instrumentType ?? 'turbo-option');

    const instruments = await active.instruments();
    const now         = new Date();
    const available   = instruments.getAvailableForBuyAt(now) as any[];
    if (available.length === 0) throw new Error('No turbo instruments available now');

    /** Duração da opção do master em segundos (timeframe) — priorizar mesmo expirationSize no turbo. */
    const masterDurSec =
      masterPos.expirationTime && masterPos.openTime
        ? Math.max(1, Math.round((masterPos.expirationTime.getTime() - masterPos.openTime.getTime()) / 1000))
        : null;

    let instrument = available[0];
    if (masterPos.expirationTime && available.length > 0) {
      const masterExp = masterPos.expirationTime.getTime();
      instrument = available.reduce((best: any, curr: any) => {
        const bestDur = typeof best.expirationSize === 'number' ? best.expirationSize : 0;
        const currDur = typeof curr.expirationSize === 'number' ? curr.expirationSize : 0;
        const targetDur = masterDurSec ?? 0;
        if (targetDur > 0) {
          const dBest = Math.abs(bestDur - targetDur);
          const dCurr = Math.abs(currDur - targetDur);
          if (dCurr !== dBest) return dCurr < dBest ? curr : best;
        }
        return Math.abs(curr.expiredAt.getTime() - masterExp) < Math.abs(best.expiredAt.getTime() - masterExp)
          ? curr
          : best;
      }, available[0]);
    }

    const dir = (masterPos.direction ?? '').toLowerCase() === 'put'
      ? TurboOptionsDirection.Put : TurboOptionsDirection.Call;

    logger.debug(
      {
        followerId,
        activeId: active.id,
        masterDurSec,
        expirationSize: instrument.expirationSize,
        expiredAt: instrument.expiredAt,
        dir,
        amount,
      },
      'Opening turbo position...'
    );
    const option = await turbo.buy(instrument, dir, amount, balance);
    return { positionId: option.id, activeName };
  }

  // ─── Subscribe once per follower to their own positions ─────────────────────
  // Primary resolution path: follower's actual SDK result (WIN / LOSS / DRAW).
  // This prevents premature resolution and draw-shown-as-WIN bugs that occur
  // when we mirror the master's closeReason to all followers.

  private async _ensureFollowerPositionSubscription(masterId: string, followerId: string): Promise<void> {
    if (this.followerPositionSubscribed.has(followerId)) return;

    try {
      const facade = await accountService.getOrInitFollowerPositions(followerId);
      if (!facade) {
        logger.warn({ followerId }, 'Cannot subscribe to follower positions: no facade');
        return;
      }

      this.followerPositionSubscribed.add(followerId);

      facade.subscribeOnUpdatePosition(async (pos: Position) => {
        const posId = pos.externalId;
        if (posId === undefined) return;
        if (!isClosedReason(pos.closeReason)) return;

        const trade = await prisma.trade.findFirst({
          where: { followerId, positionId: String(posId), status: 'OPEN' },
        });
        if (!trade) return; // not our trade or already resolved

        await this._resolveFollowerTrade(masterId, trade, pos.closeReason!);
      });

      logger.info({ followerId }, '🔔 Subscribed to follower own position updates');
    } catch (err: any) {
      logger.warn({ err: err.message, followerId }, 'Failed to subscribe to follower positions');
    }
  }

  // ─── Resolve a single follower trade from their actual SDK result ─────────────

  private async _resolveFollowerTrade(
    masterId: string,
    trade: { id: string; followerId: string | null; amount: number; openedAt: Date },
    closeReason: string,
  ): Promise<void> {
    if (!trade.followerId) return;
    const followerId = trade.followerId;
    const cr = closeReason.toLowerCase();
    let status: string;
    let profit: number;

    if (cr === 'win') {
      status = 'WIN';
      profit = parseFloat((trade.amount * 0.85).toFixed(2));
    } else if (cr === 'loss' || cr === 'loose') {
      status = 'LOSS';
      profit = -trade.amount;
    } else {
      // expired / cancel / manual / manual-close → draw: invested amount returned
      status = 'DRAW';
      profit = 0;
    }

    const updated = await prisma.trade.update({
      where: { id: trade.id },
      data:  { status, profit, closedAt: new Date() },
    });

    logger.info(
      { tradeId: trade.id, followerId, status, profit, closeReason },
      '✅ Follower trade resolved via own SDK'
    );

    const follower = accountService.getFollower(followerId);
    if (follower) {
      const startedAt = follower.sessionStats.startedAt ? new Date(follower.sessionStats.startedAt) : null;
      const shouldCount = !startedAt || new Date(trade.openedAt).getTime() >= startedAt.getTime();

      if (shouldCount) {
        const s     = (accountService.getFollower(followerId) ?? follower).sessionStats;
        const isWin = status === 'WIN';
        const stats = {
          totalTrades: s.totalTrades + 1,
          wins:        s.wins   + (isWin ? 1 : 0),
          losses:      s.losses + (status === 'LOSS' ? 1 : 0),
          profit:      parseFloat((s.profit + profit).toFixed(2)),
        };
        await accountService.updateFollowerStats(followerId, stats);
        await accountService.refreshFollowerBalance(followerId);
      }

      const fresh = accountService.getFollower(followerId);
      if (fresh) await this._checkStopConditions(masterId, followerId, fresh);
    }

    this.emit(`master:${masterId}`, 'trade:updated', updated);
    this.emit(`follower:${followerId}`, 'trade:updated', updated);

    const followers = accountService.getAllFollowers(masterId);
    followers.forEach((f) => this.emit(`master:${masterId}`, 'follower:updated', f));
  }

  // ─── Resolve trades when master position closes (fallback only) ───────────────
  // Used ONLY for followers that don't have an active SDK subscription.
  // Followers with _ensureFollowerPositionSubscription will resolve via their own events.

  private async _resolveTrades(masterId: string, masterPosId: number, closeReason: string): Promise<void> {
    const openTrades = await prisma.trade.findMany({
      where: {
        masterId,
        masterPositionId: String(masterPosId),
        status:           'OPEN',
        followerId:       { not: null },
      },
    });

    if (openTrades.length === 0) return;

    // Filter out followers whose trades will be (or were) resolved by their own subscription.
    const fallbackTrades = openTrades.filter(
      (t) => t.followerId && !this.followerPositionSubscribed.has(t.followerId)
    );

    if (fallbackTrades.length === 0) {
      logger.debug({ masterId, masterPosId }, 'All followers have own subscriptions — skipping fallback resolution');
      return;
    }

    const isWin = isWinReason(closeReason);
    logger.info(
      { masterId, masterPosId, count: fallbackTrades.length, isWin },
      '⚠️ Fallback: resolving trades for followers without own subscription'
    );

    for (const trade of fallbackTrades) {
      const fid = trade.followerId;
      if (!fid) continue;

      const status = isWin ? 'WIN' : 'LOSS';
      const profit = isWin ? parseFloat((trade.amount * 0.85).toFixed(2)) : -trade.amount;

      const updated = await prisma.trade.update({
        where: { id: trade.id },
        data:  { status, profit, closedAt: new Date() },
      });

      const follower = accountService.getFollower(fid);
      if (follower) {
        const startedAt = follower.sessionStats.startedAt ? new Date(follower.sessionStats.startedAt) : null;
        const shouldCountInSession = !startedAt || new Date(trade.openedAt).getTime() >= startedAt.getTime();

        if (shouldCountInSession) {
          const refreshedFollower = accountService.getFollower(fid) ?? follower;
          const s     = refreshedFollower.sessionStats;
          const stats = {
            totalTrades: s.totalTrades + 1,
            wins:        s.wins   + (isWin ? 1 : 0),
            losses:      s.losses + (isWin ? 0 : 1),
            profit:      parseFloat((s.profit + profit).toFixed(2)),
          };
          await accountService.updateFollowerStats(fid, stats);
          await accountService.refreshFollowerBalance(fid);
        } else {
          logger.debug(
            { tradeId: trade.id, followerId: fid, openedAt: trade.openedAt, startedAt: follower.sessionStats.startedAt },
            'Trade ignored in follower session stats (before activation)'
          );
        }

        const fresh = accountService.getFollower(fid);
        if (fresh) await this._checkStopConditions(masterId, fid, fresh);
      }

      this.emit(`master:${masterId}`, 'trade:updated', updated);
      this.emit(`follower:${fid}`, 'trade:updated', updated);
    }

    const followers = accountService.getAllFollowers(masterId);
    followers.forEach((f) => this.emit(`master:${masterId}`, 'follower:updated', f));
  }

  // ─── Stop conditions ─────────────────────────────────────────────────────────

  private async _checkStopConditions(masterId: string, followerId: string, follower: FollowerAccount): Promise<void> {
    const { stopWin, stopLoss, isActive } = follower.copySettings;
    if (!isActive) return;

    const profit = follower.sessionStats.profit;

    if (stopWin !== null && stopWin !== undefined && profit >= stopWin) {
      logger.info({ followerId, profit, stopWin }, '🎯 Stop WIN reached');
      await accountService.updateFollowerSettings(followerId, { isActive: false });
      const f = accountService.getFollower(followerId);
      if (f) this.emit(`master:${masterId}`, 'follower:updated', f);
      this.emit(`master:${masterId}`, 'follower:stopped', { followerId, reason: 'stopWin', profit });
    } else if (stopLoss !== null && stopLoss !== undefined && profit <= -Math.abs(stopLoss)) {
      logger.info({ followerId, profit, stopLoss }, '🛑 Stop LOSS reached');
      await accountService.updateFollowerSettings(followerId, { isActive: false });
      const f = accountService.getFollower(followerId);
      if (f) this.emit(`master:${masterId}`, 'follower:updated', f);
      this.emit(`master:${masterId}`, 'follower:stopped', { followerId, reason: 'stopLoss', profit });
    }
  }

  // ─── Amount calculation ──────────────────────────────────────────────────────

  private _calcAmount(follower: FollowerAccount, masterPos: Position): number {
    const { mode, amount, accountType } = follower.copySettings;
    const masterAmount = masterPos.invest ?? 10;
    const min = 1;

    switch (mode) {
      case 'fixed':
        return Math.max(min, amount);
      case 'multiplier':
        return Math.max(min, parseFloat((masterAmount * amount).toFixed(2)));
      case 'proportional': {
        const bal = accountType === 'real' ? follower.balanceReal : follower.balanceDemo;
        if (!bal || bal <= 0) return Math.max(min, amount);
        return Math.max(min, parseFloat((bal * (amount / 100)).toFixed(2)));
      }
      default:
        return Math.max(min, amount);
    }
  }

  // ─── Reset session stats for a follower (called when user restarts copy) ─────

  async resetFollowerSession(followerId: string): Promise<void> {
    await accountService.resetFollowerStatsForToday(followerId);
    logger.info({ followerId }, 'Session stats reset');
  }
}

export const copyTradeService = new CopyTradeService();
