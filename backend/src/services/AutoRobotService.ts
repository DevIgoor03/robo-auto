import { BalanceType, TurboOptionsDirection, Position } from '@quadcode-tech/client-sdk-js';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../database/prisma.js';
import { logger } from '../utils/logger.js';
import { accountService } from './AccountService.js';
import { copyTradeService } from './CopyTradeService.js';
import { decideTurboM1Direction, TURBO_M1_CANDLE_SIZE_SEC } from './robotStrategy.js';

function isClosedReason(r: string | undefined): boolean {
  if (!r) return false;
  const l = r.toLowerCase();
  return ['win', 'loss', 'loose', 'expired', 'manual', 'manual-close', 'cancel'].includes(l);
}

export type RobotMode = 'auto' | 'common';

export interface RobotStartParams {
  mode: RobotMode;
  stake: number;
  stopWin: number;
  stopLoss: number;
  accountType: 'real' | 'demo';
}

/** Intervalo entre tentativas de nova operação (M1 ~60s + margem para fecho). */
const TURBO_M1_CYCLE_MS = 70_000;

/**
 * Robô: apenas turbo-option, vela M1 (60s). Sessão termina só por parar, stop win ou stop loss.
 */
export class AutoRobotService {
  private runTokens = new Map<string, symbol>();
  private sessionProfit = new Map<string, number>();
  private sessionLimits = new Map<string, { stopWin: number; stopLoss: number }>();
  private intervalHandles = new Map<string, ReturnType<typeof setInterval>>();
  private firstTradeHandles = new Map<string, ReturnType<typeof setTimeout>>();
  private io: SocketServer | null = null;

  setSocketServer(io: SocketServer): void { this.io = io; }

  private emit(room: string, event: string, data: unknown): void {
    this.io?.to(room).emit(event, data);
  }

  isRunning(masterId: string): boolean {
    return this.runTokens.has(masterId);
  }

  getSessionProfit(masterId: string): number {
    return this.sessionProfit.get(masterId) ?? 0;
  }

  async start(masterId: string, params: RobotStartParams): Promise<{ running: boolean }> {
    if (params.mode === 'common') {
      return { running: false };
    }

    const stake = Math.max(1, Number(params.stake) || 0);
    const stopWin = Math.max(0, Number(params.stopWin) || 0);
    const stopLoss = Math.max(0, Number(params.stopLoss) || 0);

    if (copyTradeService.isRunning(masterId)) {
      await copyTradeService.stop(masterId);
    }
    if (this.runTokens.has(masterId)) {
      await this.stop(masterId);
    }

    const sdk = accountService.getMasterSdk(masterId);
    if (!sdk) throw new Error('Conta Bullex não conectada. Conecte antes de iniciar o robô.');

    await accountService.ensureMasterSessionsForToday(masterId);
    await accountService.startMasterDashboardSession(masterId);

    const facade = await accountService.getOrInitMasterPositions(masterId);
    if (!facade) {
      throw new Error('Não foi possível inicializar posições na corretora.');
    }

    const sessionToken = Symbol('robot-session');
    this.runTokens.set(masterId, sessionToken);
    this.sessionProfit.set(masterId, 0);
    this.sessionLimits.set(masterId, { stopWin, stopLoss });

    await prisma.masterAccount.update({
      where: { id: masterId },
      data:  { robotRunning: true, robotEndsAt: null, copyRunning: false },
    });

    this.emit(`master:${masterId}`, 'robot:started', {
      running: true,
      stake,
      stopWin,
      stopLoss,
      mode: params.mode,
      market: 'turbo-option',
      timeframe: `M1 (${TURBO_M1_CANDLE_SIZE_SEC}s)`,
    });

    facade.subscribeOnUpdatePosition((position: Position) => {
      if (this.runTokens.get(masterId) !== sessionToken) return;
      const posId = position.externalId;
      if (posId === undefined) return;
      if (!isClosedReason(position.closeReason)) return;

      void this._resolveRobotTrade(masterId, sessionToken, posId, position.closeReason!).catch((err) =>
        logger.error({ err: err.message, masterId, posId }, 'Erro ao resolver operação do robô')
      );
    });

    const place = () => {
      if (this.runTokens.get(masterId) !== sessionToken) return;
      void this._placeOneTurboM1(masterId, sessionToken, stake, params.accountType).catch((err) =>
        logger.warn({ err: err.message, masterId }, 'Falha ao abrir operação turbo M1')
      );
    };

    const firstId = setTimeout(place, 5_000);
    this.firstTradeHandles.set(masterId, firstId);
    const intId = setInterval(place, TURBO_M1_CYCLE_MS);
    this.intervalHandles.set(masterId, intId);

    logger.info(
      { masterId, stake, stopWin, stopLoss, cycleMs: TURBO_M1_CYCLE_MS },
      'Robô turbo M1 iniciado (sessão sem limite de tempo)',
    );

    return { running: true };
  }

  private async _placeOneTurboM1(
    masterId: string,
    sessionToken: symbol,
    amount: number,
    accountType: 'real' | 'demo',
  ): Promise<void> {
    if (this.runTokens.get(masterId) !== sessionToken) return;

    const pending = await prisma.trade.count({
      where: { masterId, followerId: null, status: 'OPEN' },
    });
    if (pending > 0) {
      logger.debug({ masterId, pending }, 'Robô: operação M1 ainda aberta — aguardando fecho');
      return;
    }

    const sdk = accountService.getMasterSdk(masterId);
    if (!sdk) return;

    const balances = await sdk.balances();
    const allBals = balances.getBalances();
    const wantedType = accountType === 'real' ? BalanceType.Real : BalanceType.Demo;
    const balance = allBals.find((b) => b.type === wantedType)
      ?? (wantedType === BalanceType.Real ? allBals.find((b) => b.type === undefined) : null);

    if (!balance) {
      logger.warn({ masterId, wantedType }, 'Saldo não encontrado para o robô');
      return;
    }

    const turbo = await sdk.turboOptions();
    const actives = turbo.getActives();
    const picked = actives.find((a: { isSuspended?: boolean }) => !a.isSuspended) ?? actives[0];
    if (!picked) throw new Error('Nenhum ativo turbo disponível');

    const active = turbo.getActive(picked.id);
    const instrumentsFacade = await active.instruments();
    const now = new Date();
    const available = instrumentsFacade.getAvailableForBuyAt(now) as {
      expirationSize: number;
      expiredAt: Date;
    }[];
    if (!available.length) {
      logger.warn({ masterId, activeId: picked.id }, 'Nenhum instrumento turbo disponível neste momento');
      return;
    }

    const instrument = available.find((i) => i.expirationSize === 60)
      ?? available.reduce((best, curr) => {
        const bd = Math.abs((best.expirationSize ?? 0) - 60);
        const cd = Math.abs((curr.expirationSize ?? 0) - 60);
        return cd < bd ? curr : best;
      }, available[0]);

    const { direction, rationale } = await decideTurboM1Direction(sdk, picked.id);
    const activeName = (active as { name?: string; ticker?: string }).name
      ?? (active as { ticker?: string }).ticker
      ?? 'Turbo';

    const option = await turbo.buy(instrument as any, direction, amount, balance);
    const posId = option.id;
    if (posId === undefined) return;

    const rationaleShort = rationale.length > 100 ? `${rationale.slice(0, 97)}...` : rationale;
    const label = `${activeName} · Turbo M1 · ${rationaleShort}`;

    await prisma.trade.create({
      data: {
        masterId,
        followerId:       null,
        followerName:     'Robô',
        masterPositionId: String(posId),
        positionId:       String(posId),
        amount,
        direction:        direction === TurboOptionsDirection.Call ? 'call' : 'put',
        instrumentName:   label,
        status:           'OPEN',
        openedAt:         new Date(),
      },
    });

    const trade = await prisma.trade.findFirst({
      where: { masterId, masterPositionId: String(posId), status: 'OPEN', followerId: null },
      orderBy: { openedAt: 'desc' },
    });
    if (trade) {
      this.emit(`master:${masterId}`, 'trade:new', trade);
    }

    logger.info(
      {
        masterId,
        posId,
        amount,
        dir: direction === TurboOptionsDirection.Call ? 'call' : 'put',
        expSec: instrument.expirationSize,
        rationale,
      },
      'Operação turbo M1 aberta',
    );
  }

  private async _resolveRobotTrade(
    masterId: string,
    sessionToken: symbol,
    posId: number,
    closeReason: string,
  ): Promise<void> {
    if (this.runTokens.get(masterId) !== sessionToken) return;

    const trade = await prisma.trade.findFirst({
      where: { masterId, positionId: String(posId), status: 'OPEN', followerId: null },
    });
    if (!trade) return;

    const cr = closeReason.toLowerCase();
    let status: 'WIN' | 'LOSS';
    let profit: number;

    if (cr === 'win') {
      status = 'WIN';
      profit = parseFloat((trade.amount * 0.85).toFixed(2));
    } else if (cr === 'loss' || cr === 'loose') {
      status = 'LOSS';
      profit = -trade.amount;
    } else {
      status = 'LOSS';
      profit = 0;
    }

    const updated = await prisma.trade.update({
      where: { id: trade.id },
      data:  { status, profit, closedAt: new Date() },
    });

    const prev = this.sessionProfit.get(masterId) ?? 0;
    const next = parseFloat((prev + profit).toFixed(2));
    this.sessionProfit.set(masterId, next);

    this.emit(`master:${masterId}`, 'trade:updated', updated);
    this.emit(`master:${masterId}`, 'robot:profit', { sessionProfit: next });

    logger.info({ masterId, tradeId: trade.id, status, profit, sessionProfit: next }, 'Operação do robô encerrada');

    await this._checkRobotStops(masterId, sessionToken, next);
  }

  private async _checkRobotStops(masterId: string, sessionToken: symbol, sessionProfitVal: number): Promise<void> {
    if (this.runTokens.get(masterId) !== sessionToken) return;

    const limits = this.sessionLimits.get(masterId);
    if (!limits) return;

    if (limits.stopWin > 0 && sessionProfitVal >= limits.stopWin) {
      logger.info({ masterId, sessionProfit: sessionProfitVal, stopWin: limits.stopWin }, 'Stop Win do robô atingido');
      await this.stop(masterId, 'stopWin');
      return;
    }
    if (limits.stopLoss > 0 && sessionProfitVal <= -Math.abs(limits.stopLoss)) {
      logger.info({ masterId, sessionProfit: sessionProfitVal, stopLoss: limits.stopLoss }, 'Stop Loss do robô atingido');
      await this.stop(masterId, 'stopLoss');
    }
  }

  async stop(masterId: string, reason: string = 'manual'): Promise<void> {
    const sessionProfitSnapshot = this.sessionProfit.get(masterId) ?? 0;
    this.runTokens.delete(masterId);
    this.sessionProfit.delete(masterId);
    this.sessionLimits.delete(masterId);

    const i = this.intervalHandles.get(masterId);
    if (i) clearInterval(i);
    this.intervalHandles.delete(masterId);

    const f = this.firstTradeHandles.get(masterId);
    if (f) clearTimeout(f);
    this.firstTradeHandles.delete(masterId);

    await prisma.masterAccount.update({
      where: { id: masterId },
      data:  { robotRunning: false, robotEndsAt: null },
    }).catch(() => {});

    this.emit(`master:${masterId}`, 'robot:stopped', { reason, sessionProfit: sessionProfitSnapshot });
    logger.info({ masterId, reason }, 'Robô automático parado');
  }
}

export const autoRobotService = new AutoRobotService();
