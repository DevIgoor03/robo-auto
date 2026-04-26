import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { accountService } from '../services/AccountService.js';
import { requirePortalToken, PortalRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { portalLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';
import { decrypt } from '../utils/crypto.js';
import { resolvePortalRouteKey } from '../utils/portalSlug.js';

const router = Router();

/** Lista pública /api/portal/traders — desligada sem apagar o handler. */
const PORTAL_TRADERS_MARKETPLACE_ENABLED = false;

// GET /api/portal/:routeKey/public — nome do master para a tela de login do seguidor (sem auth)
router.get('/:routeKey/public', portalLimiter, async (req: Request, res: Response) => {
  const routeKey = String(req.params.routeKey ?? '').trim();
  if (!routeKey) {
    res.status(400).json({ error: 'Parâmetro inválido' });
    return;
  }
  try {
    const masterInternalId = await resolvePortalRouteKey(routeKey);
    if (!masterInternalId) {
      res.status(404).json({ error: 'Copytrader não encontrado' });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { role: 'MASTER', masterAccount: { id: masterInternalId } },
      select: {
        name: true,
        portalSlug: true,
        masterAccount: { select: { name: true } },
      },
    });
    if (!user?.masterAccount) {
      res.status(404).json({ error: 'Copytrader não encontrado' });
      return;
    }
    const masterName =
      (user.masterAccount.name && user.masterAccount.name.trim()) ||
      (user.name && user.name.trim()) ||
      'Operador';
    res.json({ masterName, portalSlug: user.portalSlug ?? null });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'portal public info failed');
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

// POST /api/portal/:masterId/login
const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

router.post('/:masterId/login', portalLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const routeKey = req.params.masterId;
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  try {
    const masterInternalId = await resolvePortalRouteKey(routeKey);
    if (!masterInternalId) { res.status(404).json({ error: 'Copytrader não encontrado' }); return; }

    const allowlisted = await prisma.followerPortalAllowlist.findUnique({
      where: { masterId_bullexEmail: { masterId: masterInternalId, bullexEmail: email } },
    });
    if (!allowlisted) {
      res.status(403).json({
        error:
          'Este email não está autorizado para este copytrade. Após a compra, envie seu email Bullex ao suporte para liberação.',
        code: 'PORTAL_NOT_ALLOWLISTED',
      });
      return;
    }

    let follower;
    try {
      follower = await accountService.registerFollowerFromPortal(masterInternalId, email, password);
    } catch (sdkErr: any) {
      // Fallback: if follower already exists and password matches stored one,
      // allow login even if Bullex auth temporarily fails.
      const existing = await prisma.followerAccount.findUnique({
        where: { masterId_bullexEmail: { masterId: masterInternalId, bullexEmail: email } },
      });

      if (!existing) throw sdkErr;

      const savedPassword = decrypt(existing.encryptedPassword);
      if (savedPassword !== password) throw sdkErr;

      follower = {
        id: existing.id,
        name: existing.name,
        email: existing.bullexEmail,
        balanceReal: existing.balanceReal,
        balanceDemo: existing.balanceDemo,
        currency: existing.currency,
        isConnected: false,
        copySettings: {
          mode: existing.copyMode.toLowerCase(),
          amount: existing.copyAmount,
          accountType: existing.accountType.toLowerCase(),
          isActive: existing.isActive,
          stopWin: existing.stopWin,
          stopLoss: existing.stopLoss,
        },
        sessionStats: {
          wins: existing.wins,
          losses: existing.losses,
          totalTrades: existing.totalTrades,
          profit: existing.profit,
          startedAt: existing.sessionStartedAt?.toISOString(),
        },
      };

      logger.warn(
        { masterId: masterInternalId, followerId: existing.id, error: sdkErr?.message },
        'Portal login fallback used (Bullex unavailable or auth transient error)'
      );
    }

    const token    = `portal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.portalSession.create({ data: { followerId: follower.id, token, expiresAt } });

    // Cleanup old sessions (keep 3)
    const sessions = await prisma.portalSession.findMany({
      where: { followerId: follower.id }, orderBy: { createdAt: 'asc' },
    });
    if (sessions.length > 3) {
      const old = sessions.slice(0, sessions.length - 3).map((s) => s.id);
      await prisma.portalSession.deleteMany({ where: { id: { in: old } } });
    }

    logger.info({ followerId: follower.id, masterId: masterInternalId }, 'Portal login');
    res.json({ token, follower });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Portal login failed');
    res.status(400).json({ error: `Falha ao autenticar: ${err.message}` });
  }
});

// GET /api/portal/me
router.get('/me', requirePortalToken as any, async (req: PortalRequest, res: Response) => {
  await accountService.ensureFollowerSessionForToday(req.followerId!);
  const follower = accountService.getFollower(req.followerId!);
  if (!follower) {
    const dbF = await prisma.followerAccount.findUnique({ where: { id: req.followerId! } });
    if (!dbF) { res.status(404).json({ error: 'Conta não encontrada' }); return; }
    res.json({
      id: dbF.id, name: dbF.name, email: dbF.bullexEmail,
      balanceReal: dbF.balanceReal, balanceDemo: dbF.balanceDemo, currency: dbF.currency,
      isConnected: false, masterId: dbF.masterId,
      copySettings: { mode: dbF.copyMode.toLowerCase(), amount: dbF.copyAmount, accountType: dbF.accountType.toLowerCase(), isActive: dbF.isActive, stopWin: dbF.stopWin, stopLoss: dbF.stopLoss },
      sessionStats:  {
        wins: dbF.wins,
        losses: dbF.losses,
        totalTrades: dbF.totalTrades,
        profit: dbF.profit,
        startedAt: dbF.sessionStartedAt?.toISOString(),
      },
    });
    return;
  }
  res.json({ ...follower, masterId: req.masterId });
});

// POST /api/portal/copy/toggle
const toggleCopySchema = z.object({
  isActive: z.boolean(),
});

router.post('/copy/toggle', requirePortalToken as any, validate(toggleCopySchema), async (req: PortalRequest, res: Response) => {
  try {
    if (req.body.isActive) {
      await accountService.ensureFollowerBullexSessionForCopy(req.followerId!);
    }
    const updated = await accountService.setFollowerDailyActivation(req.followerId!, req.body.isActive);
    if (!updated) {
      const dbF = await prisma.followerAccount.findUnique({ where: { id: req.followerId! } });
      if (!dbF) { res.status(404).json({ error: 'Conta não encontrada' }); return; }
      res.json({
        copySettings: {
          mode: dbF.copyMode.toLowerCase(),
          amount: dbF.copyAmount,
          accountType: dbF.accountType.toLowerCase(),
          isActive: dbF.isActive,
          stopWin: dbF.stopWin,
          stopLoss: dbF.stopLoss,
        },
      });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/portal/settings
const settingsSchema = z.object({
  mode:        z.enum(['fixed', 'multiplier', 'proportional']).optional(),
  amount:      z.number().min(0).optional(),
  accountType: z.enum(['real', 'demo']).optional(),
  isActive:    z.boolean().optional(),
  stopWin:     z.number().nullable().optional(),
  stopLoss:    z.number().nullable().optional(),
});

router.patch('/settings', requirePortalToken as any, validate(settingsSchema), async (req: PortalRequest, res: Response) => {
  try {
    const updated = await accountService.updateFollowerSettings(req.followerId!, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/portal/trades
router.get('/trades', requirePortalToken as any, async (req: PortalRequest, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string ?? '1',  10));
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string ?? '50', 10)), 100);
  const skip  = (page - 1) * limit;
  const status = (req.query.status as string | undefined)?.toUpperCase();
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();

  const follower = await prisma.followerAccount.findUnique({
    where: { id: req.followerId! },
    select: { sessionStartedAt: true },
  });
  const sessionStartedAt = follower?.sessionStartedAt ?? null;

  const where: any = { followerId: req.followerId };
  if (status && status !== 'ALL') where.status = status;
  const openedAtFilter: any = {};
  if (from) openedAtFilter.gte = new Date(from);
  if (to) openedAtFilter.lte = new Date(to);
  if (Object.keys(openedAtFilter).length > 0) where.openedAt = openedAtFilter;
  if (search) {
    where.OR = [
      { instrumentName: { contains: search, mode: 'insensitive' } },
      { direction: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take:    limit, skip,
    }),
    prisma.trade.count({ where }),
  ]);

  // Session summary (desde ativação do copy do seguidor)
  const now = new Date();
  const sessionStart = sessionStartedAt ?? new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayWhere: any = {
    followerId: req.followerId,
    openedAt: { gte: sessionStart, lte: now },
  };
  const [todayWins, todayLosses, todayOpen, todayProfitAgg] = await Promise.all([
    prisma.trade.count({ where: { ...todayWhere, status: 'WIN' } }),
    prisma.trade.count({ where: { ...todayWhere, status: 'LOSS' } }),
    prisma.trade.count({ where: { ...todayWhere, status: 'OPEN' } }),
    prisma.trade.aggregate({
      where: { ...todayWhere, NOT: { status: 'OPEN' } },
      _sum: { profit: true },
    }),
  ]);

  res.json({
    trades: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
    today: {
      wins: todayWins,
      losses: todayLosses,
      open: todayOpen,
      totalTrades: todayWins + todayLosses + todayOpen,
      profit: todayProfitAgg._sum?.profit ?? 0,
    },
  });
});

// POST /api/portal/logout
router.post('/logout', requirePortalToken as any, async (req: PortalRequest, res: Response) => {
  const token = req.headers['x-portal-token'] as string;
  await prisma.portalSession.deleteMany({ where: { token } });
  res.json({ success: true });
});

// GET /api/portal/traders — público (marketplace; pode ficar desativado)
router.get('/traders', async (_req: Request, res: Response) => {
  if (!PORTAL_TRADERS_MARKETPLACE_ENABLED) {
    res.json({ traders: [], marketplaceDisabled: true });
    return;
  }
  try {
    const users = await prisma.user.findMany({
      where: { role: 'MASTER', masterAccount: { isNot: null } },
      select: {
        id: true, name: true, subscriptionPlan: true, portalSlug: true, createdAt: true,
        masterAccount: {
          select: {
            id: true, name: true, isConnected: true, copyRunning: true, currency: true,
            _count: { select: { followers: true, trades: true } },
          },
        },
      },
    });

    const maIds = users.filter(u => u.masterAccount).map(u => u.masterAccount!.id);
    if (maIds.length === 0) { res.json({ traders: [] }); return; }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [allStats, recentStats] = await Promise.all([
      prisma.trade.groupBy({
        by: ['masterId', 'status'],
        where: { masterId: { in: maIds }, status: { in: ['WIN', 'LOSS'] } },
        _count: { id: true },
        _sum: { profit: true },
      }),
      prisma.trade.groupBy({
        by: ['masterId', 'status'],
        where: { masterId: { in: maIds }, status: { in: ['WIN', 'LOSS'] }, openedAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        _sum: { profit: true },
      }),
    ]);

    type StatEntry = { wins: number; losses: number; profit: number };
    const toMap = (rows: { masterId: string; status: string; _count: { id: number }; _sum: { profit: number | null } }[]): Record<string, StatEntry> => {
      const m: Record<string, StatEntry> = {};
      for (const r of rows) {
        if (!m[r.masterId]) m[r.masterId] = { wins: 0, losses: 0, profit: 0 };
        if (r.status === 'WIN') { m[r.masterId].wins = r._count.id; m[r.masterId].profit += r._sum.profit ?? 0; }
        else { m[r.masterId].losses = r._count.id; }
      }
      return m;
    };

    const allMap = toMap(allStats);
    const recentMap = toMap(recentStats);

    const traders = users
      .filter(u => u.masterAccount)
      .map(u => {
        const ma = u.masterAccount!;
        const all = allMap[ma.id] ?? { wins: 0, losses: 0, profit: 0 };
        const recent = recentMap[ma.id] ?? { wins: 0, losses: 0, profit: 0 };
        const totalClosed = all.wins + all.losses;
        const recentClosed = recent.wins + recent.losses;
        const winRate = totalClosed > 0 ? Math.round((all.wins / totalClosed) * 100) : 0;
        const recentWinRate = recentClosed > 0 ? Math.round((recent.wins / recentClosed) * 100) : winRate;

        return {
          id: u.portalSlug ?? ma.id,
          name: ma.name || u.name,
          plan: u.subscriptionPlan,
          isActive: ma.isConnected || ma.copyRunning,
          followerCount: ma._count.followers,
          totalTrades: ma._count.trades,
          wins: all.wins,
          losses: all.losses,
          winRate,
          recentWinRate,
          totalProfit: all.profit,
          recentProfit: recent.profit,
          currency: ma.currency,
          since: u.createdAt,
        };
      })
      .sort((a, b) => b.winRate - a.winRate || b.totalTrades - a.totalTrades)
      .slice(0, 5);

    res.json({ traders });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to list traders');
    res.status(500).json({ error: 'Erro ao buscar traders' });
  }
});

export default router;
