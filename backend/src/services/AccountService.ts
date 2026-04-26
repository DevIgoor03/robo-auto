import {
  ClientSdk, LoginPasswordAuthMethod, BalanceType, Balance, Positions,
} from '@quadcode-tech/client-sdk-js';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../database/prisma.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { planService } from './PlanService.js';
import { AccountInfo, CopySettings, FollowerAccount, SessionStats } from '../types.js';

interface SdkEntry {
  sdk:             ClientSdk;
  email:           string;
  name:            string;
  positionsFacade: Positions | null;
  realBalance:     Balance | null;
  demoBalance:     Balance | null;
}

// Clean struct — masterId is first-class, not a dynamic property
interface FollowerConn {
  entry:    SdkEntry;
  account:  FollowerAccount;
  masterId: string;
  followerActivatedDay: string;
}

export class AccountService {
  private masterConnections   = new Map<string, SdkEntry>();
  private followerConnections = new Map<string, FollowerConn>();
  private io: SocketServer | null = null;

  // Login cooldown: prevents flooding the Quadcode API (which blocks IPs after
  // too many requests). Stores the last login attempt timestamp per email.
  private lastLoginAttempt = new Map<string, number>();
  private readonly LOGIN_COOLDOWN_MS = 30_000; // 30 seconds between attempts

  private canAttemptLogin(email: string): boolean {
    const last = this.lastLoginAttempt.get(email.toLowerCase());
    if (!last) return true;
    const elapsed = Date.now() - last;
    if (elapsed < this.LOGIN_COOLDOWN_MS) {
      logger.warn(
        { email, retryInMs: this.LOGIN_COOLDOWN_MS - elapsed },
        '⏳ Login cooldown active — skipping to avoid Quadcode IP rate-limit'
      );
      return false;
    }
    return true;
  }

  private markLoginAttempt(email: string): void {
    this.lastLoginAttempt.set(email.toLowerCase(), Date.now());
  }

  setSocketServer(io: SocketServer): void { this.io = io; }

  private emit(room: string, event: string, data: unknown): void {
    this.io?.to(room).emit(event, data);
  }

  private getTodayKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ─── Master ──────────────────────────────────────────────────────────────────

  async connectMaster(userId: string, bullexEmail: string, bullexPassword: string, skipCooldown = false): Promise<AccountInfo> {
    logger.info({ userId, bullexEmail }, 'Connecting master account...');

    if (!skipCooldown && !this.canAttemptLogin(bullexEmail)) {
      throw new Error('Aguarde alguns segundos antes de tentar conectar novamente (proteção anti-bloqueio de IP).');
    }
    this.markLoginAttempt(bullexEmail);

    const sdk = await ClientSdk.create(
      config.bullex.wsUrl, config.bullex.platformId,
      new LoginPasswordAuthMethod(config.bullex.apiUrl, bullexEmail, bullexPassword)
    );

    const profile  = sdk.userProfile;
    const balances = await sdk.balances();
    const all      = balances.getBalances();

    // SDK only maps typeId 1→Real and 4→Demo. Other types (marketing, tournament, etc.)
    // return type=undefined. We fall back to the first non-Demo balance as "real".
    const realBal  = all.find((b) => b.type === BalanceType.Real)
      ?? all.find((b) => b.type === undefined)
      ?? null;
    const demoBal  = all.find((b) => b.type === BalanceType.Demo) ?? null;

    logger.info(
      { bullexEmail, balances: all.map((b) => ({ id: b.id, type: b.type, amount: b.amount, currency: b.currency })) },
      'Master balances detected'
    );

    const name     = `${profile.firstName} ${profile.lastName}`.trim() || bullexEmail.split('@')[0];
    const currency = realBal?.currency ?? demoBal?.currency ?? 'USD';

    const dbMaster = await prisma.masterAccount.upsert({
      where:  { userId },
      create: { userId, bullexEmail, encryptedPassword: encrypt(bullexPassword), name, currency, isConnected: true, balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0 },
      update: { bullexEmail, encryptedPassword: encrypt(bullexPassword), name, currency, isConnected: true, balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0 },
    });

    const entry: SdkEntry = { sdk, email: bullexEmail, name, positionsFacade: null, realBalance: realBal, demoBalance: demoBal };

    realBal?.subscribeOnUpdate((u) => {
      entry.realBalance = u as unknown as Balance;
      prisma.masterAccount.update({ where: { id: dbMaster.id }, data: { balanceReal: u.amount } }).catch(() => {});
      this.emit(`master:${dbMaster.id}`, 'master:balance', { balanceReal: u.amount, balanceDemo: entry.demoBalance?.amount ?? 0, currency: u.currency });
    });
    demoBal?.subscribeOnUpdate((u) => {
      entry.demoBalance = u as unknown as Balance;
      prisma.masterAccount.update({ where: { id: dbMaster.id }, data: { balanceDemo: u.amount } }).catch(() => {});
      this.emit(`master:${dbMaster.id}`, 'master:balance', { balanceReal: entry.realBalance?.amount ?? 0, balanceDemo: u.amount, currency: u.currency });
    });

    this.masterConnections.set(dbMaster.id, entry);
    logger.info({ masterId: dbMaster.id, name }, 'Master connected OK');

    return {
      id: dbMaster.id, name, email: bullexEmail,
      balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0,
      currency, isConnected: true, connectedAt: new Date().toISOString(),
    };
  }

  async disconnectMaster(masterId: string): Promise<void> {
    this.masterConnections.delete(masterId);
    await prisma.masterAccount.update({
      where: { id: masterId },
      data:  { isConnected: false, copyRunning: false, robotRunning: false, robotEndsAt: null },
    });
    logger.info({ masterId }, 'Master disconnected');
  }

  getMasterSdk(masterId: string): ClientSdk | null {
    return this.masterConnections.get(masterId)?.sdk ?? null;
  }

  getMasterInfo(masterId: string): AccountInfo | null {
    const e = this.masterConnections.get(masterId);
    if (!e) return null;
    return {
      id: masterId, name: e.name, email: e.email,
      balanceReal: e.realBalance?.amount ?? 0, balanceDemo: e.demoBalance?.amount ?? 0,
      currency: e.realBalance?.currency ?? 'USD', isConnected: true,
    };
  }

  async getOrInitMasterPositions(masterId: string): Promise<Positions | null> {
    const entry = this.masterConnections.get(masterId);
    if (!entry) { logger.warn({ masterId }, 'getOrInitMasterPositions: master not in memory'); return null; }
    if (!entry.positionsFacade) {
      logger.debug({ masterId }, 'Initializing positions facade...');
      entry.positionsFacade = await entry.sdk.positions();
      logger.debug({ masterId }, 'Positions facade ready');
    }
    return entry.positionsFacade;
  }

  // ─── Follower ─────────────────────────────────────────────────────────────────

  async addFollower(masterId: string, bullexEmail: string, bullexPassword: string, copySettings: CopySettings): Promise<FollowerAccount> {
    return this._connectFollower(masterId, bullexEmail, bullexPassword, copySettings);
  }

  async registerFollowerFromPortal(masterId: string, bullexEmail: string, bullexPassword: string): Promise<FollowerAccount> {
    const existing = await prisma.followerAccount.findUnique({ where: { masterId_bullexEmail: { masterId, bullexEmail } } });
    if (!existing) await planService.assertCanAddFollower(masterId);
    const settings: CopySettings = existing
      ? { mode: existing.copyMode.toLowerCase() as any, amount: existing.copyAmount, accountType: existing.accountType.toLowerCase() as any, isActive: existing.isActive, stopWin: existing.stopWin, stopLoss: existing.stopLoss }
      : { mode: 'fixed', amount: 5, accountType: 'real', isActive: false, stopWin: null, stopLoss: null };
    return this._connectFollower(masterId, bullexEmail, bullexPassword, settings);
  }

  private async _connectFollower(masterId: string, bullexEmail: string, bullexPassword: string, settings: CopySettings, skipCooldown = false): Promise<FollowerAccount> {
    logger.info({ masterId, bullexEmail }, 'Connecting follower...');

    if (!skipCooldown && !this.canAttemptLogin(bullexEmail)) {
      throw new Error(`Cooldown ativo para ${bullexEmail} — aguarde antes de reconectar.`);
    }
    this.markLoginAttempt(bullexEmail);

    const sdk = await ClientSdk.create(
      config.bullex.wsUrl, config.bullex.platformId,
      new LoginPasswordAuthMethod(config.bullex.apiUrl, bullexEmail, bullexPassword)
    );

    const profile  = sdk.userProfile;
    const balances = await sdk.balances();
    const all      = balances.getBalances();

    // SDK only maps typeId 1→Real and 4→Demo. Other account types (marketing, tournament,
    // promo, etc.) return type=undefined. Fall back to the first available non-Demo balance.
    const realBal  = all.find((b) => b.type === BalanceType.Real)
      ?? all.find((b) => b.type === undefined)
      ?? null;
    const demoBal  = all.find((b) => b.type === BalanceType.Demo) ?? null;

    logger.info(
      { bullexEmail, masterId, balances: all.map((b) => ({ id: b.id, type: b.type, amount: b.amount, currency: b.currency })) },
      'Follower balances detected'
    );

    const name     = `${profile.firstName} ${profile.lastName}`.trim() || bullexEmail.split('@')[0];
    const currency = realBal?.currency ?? demoBal?.currency ?? 'USD';

    const dbFollower = await prisma.followerAccount.upsert({
      where:  { masterId_bullexEmail: { masterId, bullexEmail } },
      create: {
        masterId, bullexEmail, encryptedPassword: encrypt(bullexPassword), name, currency,
        copyMode: settings.mode.toUpperCase() as any, copyAmount: settings.amount,
        accountType: settings.accountType.toUpperCase() as any, isActive: settings.isActive,
        followerActivatedDay: '',
        sessionStartedAt: null,
        stopWin: settings.stopWin, stopLoss: settings.stopLoss,
        balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0,
        sessionDay: this.getTodayKey(),
      },
      update: {
        encryptedPassword: encrypt(bullexPassword), name, currency,
        balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0,
      },
    });

    const activeSettings: CopySettings = {
      mode:        dbFollower.copyMode.toLowerCase() as any,
      amount:      dbFollower.copyAmount,
      accountType: dbFollower.accountType.toLowerCase() as any,
      isActive:    dbFollower.isActive,
      stopWin:     dbFollower.stopWin,
      stopLoss:    dbFollower.stopLoss,
    };

    const account: FollowerAccount = {
      id: dbFollower.id, name, email: bullexEmail,
      balanceReal: realBal?.amount ?? 0, balanceDemo: demoBal?.amount ?? 0,
      currency, isConnected: true, copySettings: activeSettings,
      sessionStats: {
        wins: dbFollower.wins,
        losses: dbFollower.losses,
        totalTrades: dbFollower.totalTrades,
        profit: dbFollower.profit,
        startedAt: dbFollower.sessionStartedAt?.toISOString(),
      },
      connectedAt: new Date().toISOString(),
    };

    const entry: SdkEntry = { sdk, email: bullexEmail, name, positionsFacade: null, realBalance: realBal, demoBalance: demoBal };

    // Balance subscriptions — update in-memory + DB + emit to dashboard
    realBal?.subscribeOnUpdate((u) => {
      const conn = this.followerConnections.get(dbFollower.id);
      if (conn) {
        conn.account.balanceReal = u.amount;
        prisma.followerAccount.update({ where: { id: dbFollower.id }, data: { balanceReal: u.amount } }).catch(() => {});
        this.emit(`master:${masterId}`, 'follower:updated', conn.account);
      }
    });
    demoBal?.subscribeOnUpdate((u) => {
      const conn = this.followerConnections.get(dbFollower.id);
      if (conn) {
        conn.account.balanceDemo = u.amount;
        prisma.followerAccount.update({ where: { id: dbFollower.id }, data: { balanceDemo: u.amount } }).catch(() => {});
        this.emit(`master:${masterId}`, 'follower:updated', conn.account);
      }
    });

    // Store with masterId as first-class field
    this.followerConnections.set(dbFollower.id, {
      entry,
      account,
      masterId,
      followerActivatedDay: dbFollower.followerActivatedDay,
    });
    this.emit(`master:${masterId}`, 'follower:updated', account);
    logger.info({ followerId: dbFollower.id, masterId, name }, 'Follower connected OK');

    return account;
  }

  // ─── Restore from DB on startup ───────────────────────────────────────────────

  async restoreFromDb(): Promise<void> {
    const masters = await prisma.masterAccount.findMany({ where: { isConnected: true } });
    logger.info({ count: masters.length }, 'Restaurando contas Bullex a partir da base de dados...');

    if (masters.length === 0) {
      logger.info('Restore complete');
      return;
    }

    // CONSERVATIVE RESTORE: We deliberately do NOT call connectMaster() here
    // because every server restart (tsx watch on file save) would trigger N login
    // attempts to api.trade.bull-ex.com, which causes Quadcode to block the IP.
    //
    // Instead: mark all as disconnected so the dashboard shows the reconnect prompt.
    // The user manually reconnects via the modal (one controlled login call).
    for (const m of masters) {
      await prisma.masterAccount.update({
        where: { id: m.id },
        data:  { isConnected: false, copyRunning: false, robotRunning: false, robotEndsAt: null },
      }).catch(() => {});
      logger.info({ masterId: m.id, email: m.bullexEmail }, 'Marked master as disconnected (manual reconnect required)');
    }

    logger.info('Restore complete — user must reconnect via dashboard');
  }

  // ─── Follower helpers ─────────────────────────────────────────────────────────

  async getOrInitFollowerPositions(followerId: string): Promise<Positions | null> {
    const conn = this.followerConnections.get(followerId);
    if (!conn) return null;
    if (!conn.entry.positionsFacade) conn.entry.positionsFacade = await conn.entry.sdk.positions();
    return conn.entry.positionsFacade;
  }

  getFollowerSdk(followerId: string): ClientSdk | null {
    return this.followerConnections.get(followerId)?.entry.sdk ?? null;
  }

  getFollower(followerId: string): FollowerAccount | null {
    return this.followerConnections.get(followerId)?.account ?? null;
  }

  /** Get all active followers for a given master (from in-memory connections).
   *  A follower is considered active if isActive=true.
   *  followerActivatedDay is used ONLY by the portal button to let followers
   *  opt-in daily — it does NOT block copy trading for master-managed followers.
   */
  getActiveFollowers(masterId: string): FollowerAccount[] {
    return Array.from(this.followerConnections.values())
      .filter((c) => c.masterId === masterId && c.account.copySettings.isActive)
      .map((c) => c.account);
  }

  /** Get ALL followers for a given master (including inactive) */
  getAllFollowers(masterId: string): FollowerAccount[] {
    return Array.from(this.followerConnections.values())
      .filter((c) => c.masterId === masterId)
      .map((c) => c.account);
  }

  async removeFollower(followerId: string): Promise<void> {
    const conn = this.followerConnections.get(followerId);
    const masterId = conn?.masterId;
    this.followerConnections.delete(followerId);
    await prisma.followerAccount.delete({ where: { id: followerId } });
    if (masterId && conn) this.emit(`master:${masterId}`, 'follower:removed', { followerId });
    logger.info({ followerId }, 'Follower removed');
  }

  async updateFollowerSettings(followerId: string, settings: Partial<CopySettings>): Promise<FollowerAccount | null> {
    const normalized: Partial<CopySettings> = { ...settings, accountType: 'real' };
    const conn = this.followerConnections.get(followerId);
    if (!conn) {
      // Not in memory — update DB only
      const f = await prisma.followerAccount.findUnique({ where: { id: followerId } });
      if (!f) return null;
      await prisma.followerAccount.update({ where: { id: followerId }, data: this._settingsToDb(normalized) });
      return null;
    }
    conn.account.copySettings = { ...conn.account.copySettings, ...normalized };
    await prisma.followerAccount.update({ where: { id: followerId }, data: this._settingsToDb(normalized) });
    this.emit(`master:${conn.masterId}`, 'follower:updated', conn.account);
    return conn.account;
  }

  private _settingsToDb(s: Partial<CopySettings>): Record<string, any> {
    const d: Record<string, any> = {};
    if (s.mode        !== undefined) d.copyMode    = s.mode.toUpperCase();
    if (s.amount      !== undefined) d.copyAmount  = s.amount;
    if (s.accountType !== undefined) d.accountType = 'REAL';
    if (s.isActive    !== undefined) d.isActive    = s.isActive;
    if (s.stopWin     !== undefined) d.stopWin     = s.stopWin;
    if (s.stopLoss    !== undefined) d.stopLoss    = s.stopLoss;
    return d;
  }

  async updateFollowerStats(followerId: string, updates: Partial<SessionStats>): Promise<void> {
    const conn = this.followerConnections.get(followerId);
    if (conn) conn.account.sessionStats = { ...conn.account.sessionStats, ...updates };
    const s = conn?.account.sessionStats ?? updates;
    await prisma.followerAccount.update({
      where: { id: followerId },
      data: { totalTrades: s.totalTrades, wins: s.wins, losses: s.losses, profit: s.profit },
    }).catch(() => {});
  }

  async resetFollowerStatsForToday(followerId: string): Promise<void> {
    const conn  = this.followerConnections.get(followerId);
    const today = this.getTodayKey();

    // Only reset stats — do NOT touch isActive so copy trading keeps working
    if (conn) {
      conn.account.sessionStats = { wins: 0, losses: 0, totalTrades: 0, profit: 0 };
      this.emit(`master:${conn.masterId}`, 'follower:updated', conn.account);
    }

    await prisma.followerAccount.update({
      where: { id: followerId },
      data:  { wins: 0, losses: 0, totalTrades: 0, profit: 0, sessionDay: today },
    }).catch(() => {});
  }

  async ensureFollowerSessionForToday(followerId: string): Promise<boolean> {
    // Sessão do seguidor é baseada em ativação explícita do copy, não em virada de dia.
    // Método preservado por compatibilidade.
    return false;
  }

  async setFollowerDailyActivation(followerId: string, isActive: boolean): Promise<FollowerAccount | null> {
    const conn  = this.followerConnections.get(followerId);
    const today = this.getTodayKey();
    const now = new Date();
    const data = isActive
      ? {
        isActive: true,
        followerActivatedDay: today,
        // Ativar copy inicia nova sessão para o seguidor.
        sessionStartedAt: now,
        wins: 0,
        losses: 0,
        totalTrades: 0,
        profit: 0,
        sessionDay: today,
      }
      : {
        isActive: false,
        followerActivatedDay: '',
      };

    const updated = await prisma.followerAccount.update({
      where: { id: followerId },
      data,
    });

    if (!conn) {
      if (isActive) {
        await this.startMasterDashboardSession(updated.masterId, now);
      }
      const payload: FollowerAccount = {
        id: updated.id,
        name: updated.name,
        email: updated.bullexEmail,
        balanceReal: updated.balanceReal,
        balanceDemo: updated.balanceDemo,
        currency: updated.currency,
        isConnected: false,
        copySettings: {
          mode:        updated.copyMode.toLowerCase() as any,
          amount:      updated.copyAmount,
          accountType: updated.accountType.toLowerCase() as any,
          isActive:    updated.isActive,
          stopWin:     updated.stopWin,
          stopLoss:    updated.stopLoss,
        },
        sessionStats: {
          wins: updated.wins, losses: updated.losses,
          totalTrades: updated.totalTrades, profit: updated.profit,
          startedAt: updated.sessionStartedAt?.toISOString(),
        },
      };
      this.emit(`master:${updated.masterId}`, 'follower:updated', payload);
      return payload;
    }

    conn.account.copySettings.isActive = isActive;
    conn.followerActivatedDay = isActive ? today : '';
    if (isActive) {
      conn.account.sessionStats = { wins: 0, losses: 0, totalTrades: 0, profit: 0, startedAt: now.toISOString() };
      // Reset do dashboard do master quando seguidor ativa copy.
      await this.startMasterDashboardSession(conn.masterId, now);
    }
    this.emit(`master:${conn.masterId}`, 'follower:updated', conn.account);
    return conn.account;
  }

  async ensureMasterSessionsForToday(masterId: string): Promise<number> {
    // Sessão deixa de depender de virada de dia. Agora é controlada por ativação.
    return 0;
  }

  async startMasterDashboardSession(masterId: string, startedAt = new Date()): Promise<void> {
    await prisma.masterAccount.update({
      where: { id: masterId },
      data: { dashboardSessionStartedAt: startedAt },
    }).catch(() => {});
  }

  async refreshFollowerBalance(followerId: string): Promise<void> {
    const conn = this.followerConnections.get(followerId);
    if (!conn) return;
    try {
      const bals = await conn.entry.sdk.balances();
      const all  = bals.getBalances();
      const r = all.find((b) => b.type === BalanceType.Real);
      const d = all.find((b) => b.type === BalanceType.Demo);
      if (r) { conn.entry.realBalance = r; conn.account.balanceReal = r.amount; }
      if (d) { conn.entry.demoBalance = d; conn.account.balanceDemo = d.amount; }
      await prisma.followerAccount.update({ where: { id: followerId }, data: { balanceReal: conn.account.balanceReal, balanceDemo: conn.account.balanceDemo } }).catch(() => {});
    } catch (err: any) {
      logger.warn({ err: err.message, followerId }, 'Failed to refresh follower balance');
    }
  }

  private readonly PING_BULLEX_MS = 12_000;

  /** Confirma que a sessão Bullex responde (saldos). */
  private async _pingSdkBalances(sdk: ClientSdk): Promise<void> {
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Tempo esgotado ao contactar a Bullex')), this.PING_BULLEX_MS)
    );
    await Promise.race([
      (async () => {
        const bal = await sdk.balances();
        bal.getBalances();
      })(),
      timeout,
    ]);
  }

  /**
   * Antes de ativar o copy no portal: garante SDK em memória e sessão viva.
   * Se o ping falhar ou não houver SDK, reconecta com credenciais guardadas (encrypted).
   */
  async ensureFollowerBullexSessionForCopy(followerId: string): Promise<void> {
    const row = await prisma.followerAccount.findUnique({ where: { id: followerId } });
    if (!row) throw new Error('Conta de seguidor não encontrada');

    const sdk0 = this.getFollowerSdk(followerId);
    if (sdk0) {
      try {
        await this._pingSdkBalances(sdk0);
        logger.info({ followerId }, 'Seguidor: sessão Bullex OK (ping)');
        return;
      } catch (e: any) {
        logger.warn({ followerId, err: e?.message }, 'Seguidor: ping falhou — a reconectar à Bullex');
        this.followerConnections.delete(followerId);
      }
    }

    const password = decrypt(row.encryptedPassword);
    const settings: CopySettings = {
      mode: row.copyMode.toLowerCase() as any,
      amount: row.copyAmount,
      accountType: row.accountType.toLowerCase() as any,
      isActive: row.isActive,
      stopWin: row.stopWin,
      stopLoss: row.stopLoss,
    };

    await this._connectFollower(row.masterId, row.bullexEmail, password, settings, true);

    const sdk1 = this.getFollowerSdk(followerId);
    if (!sdk1) {
      throw new Error('Não foi possível estabelecer ligação à Bullex. Tente sair e entrar de novo no portal com email e senha.');
    }
    try {
      await this._pingSdkBalances(sdk1);
    } catch (e: any) {
      throw new Error(
        `Ligação à Bullex instável após reconexão: ${e?.message ?? 'erro desconhecido'}. Tente novamente em instantes.`
      );
    }
  }
}

export const accountService = new AccountService();
