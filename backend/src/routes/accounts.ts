import { Router, Response } from 'express';
import { z } from 'zod';
import { accountService }   from '../services/AccountService.js';
import { copyTradeService } from '../services/CopyTradeService.js';
import { autoRobotService } from '../services/AutoRobotService.js';
import { authService }      from '../services/AuthService.js';
import { requireAuth, requireMaster, AuthRequest } from '../middleware/auth.js';
import { validate }  from '../middleware/validate.js';
import { prisma }    from '../database/prisma.js';
import { logger }    from '../utils/logger.js';
import { planService } from '../services/PlanService.js';

const router = Router();

router.use(requireAuth as any);
router.use(requireMaster as any);

// ─── Helper: resolve masterId (JWT may be stale after first connect) ──────────
async function resolveMasterId(req: AuthRequest): Promise<string | null> {
  if (req.user!.masterId) return req.user!.masterId;
  const m = await prisma.masterAccount.findUnique({ where: { userId: req.user!.userId } });
  return m?.id ?? null;
}

// ─── Master connection ────────────────────────────────────────────────────────

const connectMasterSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

router.post('/master/connect', validate(connectMasterSchema), async (req: AuthRequest, res: Response) => {
  try {
    // skipCooldown=true because this is a deliberate user action, not an auto-restore
    const info = await accountService.connectMaster(req.user!.userId, req.body.email, req.body.password, true);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }

    const tokens = authService.generateTokenPair({
      userId:   user.id,
      masterId: info.id,
      role:     user.role,
      email:    user.email,
    });

    res.json({ ...info, ...tokens });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to connect master');
    const msg = err.message?.toLowerCase() ?? '';
    let friendlyError = `Falha ao conectar: ${err.message}`;
    if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('enotfound')) {
      friendlyError = 'Não foi possível alcançar os servidores da corretora Bullex. Verifique a sua ligação à internet ou tente novamente dentro de alguns minutos.';
    } else if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('invalid') || msg.includes('password') || msg.includes('credentials')) {
      friendlyError = 'Credenciais inválidas. Verifique seu email e senha da Bullex.';
    }
    res.status(400).json({ error: friendlyError });
  }
});

router.delete('/master', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(400).json({ error: 'Nenhum master conectado' }); return; }
    if (copyTradeService.isRunning(masterId)) await copyTradeService.stop(masterId);
    if (autoRobotService.isRunning(masterId)) await autoRobotService.stop(masterId);
    await accountService.disconnectMaster(masterId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Diagnóstico: lista os saldos disponíveis de um seguidor ─────────────────
router.get('/follower/:followerId/balances', async (req: AuthRequest, res: Response) => {
  try {
    const sdk = accountService.getFollowerSdk(req.params.followerId);
    if (!sdk) { res.status(404).json({ error: 'Seguidor não conectado na memória' }); return; }
    const balances = await sdk.balances();
    const all = balances.getBalances();
    res.json({
      balances: all.map((b) => ({
        id:       b.id,
        type:     b.type ?? 'unknown (marketing/tournament/promo)',
        amount:   b.amount,
        currency: b.currency,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fix: reativa seguidores que ficaram isActive=false pelo bug do reset ─────
router.post('/followers/reactivate-all', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(400).json({ error: 'Sem master' }); return; }

    const result = await prisma.followerAccount.updateMany({
      where: { masterId, isActive: false },
      data:  { isActive: true },
    });

    // Sync in-memory
    const followers = accountService.getAllFollowers(masterId);
    followers.forEach((f) => {
      if (!f.copySettings.isActive) f.copySettings.isActive = true;
    });

    logger.info({ masterId, count: result.count }, 'Reactivated all followers');
    res.json({ reactivated: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Copy trading control ─────────────────────────────────────────────────────

router.post('/copy/start', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId || !accountService.getMasterSdk(masterId)) {
      res.status(400).json({ error: 'Conta master não conectada. Conecte a conta Bullex primeiro.' }); return;
    }

    if (autoRobotService.isRunning(masterId)) await autoRobotService.stop(masterId);

    await accountService.ensureMasterSessionsForToday(masterId);
    await accountService.startMasterDashboardSession(masterId);

    await copyTradeService.start(masterId);
    const followers = accountService.getAllFollowers(masterId);
    res.json({ running: true, followers });
  } catch (err: any) {
    logger.error({ err: err.message }, 'copy/start error');
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/session/reset — desabilitado para master (regra de negócio)
router.post('/session/reset', async (req: AuthRequest, res: Response) => {
  res.status(403).json({
    error: 'Reset de sessão pelo master foi desativado. Somente seguidores ativam o copy no próprio portal.',
  });
});

router.post('/copy/stop', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(400).json({ error: 'Nenhum master' }); return; }
    await copyTradeService.stop(masterId);
    res.json({ running: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Robô automático (conta própria, sem copy) ───────────────────────────────

const robotStartSchema = z.object({
  mode:        z.enum(['auto', 'common']),
  stake:       z.number().min(1),
  stopWin:     z.number().min(0),
  stopLoss:    z.number().min(0),
  accountType: z.enum(['real', 'demo']).default('demo'),
});

router.post('/robot/start', validate(robotStartSchema), async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId || !accountService.getMasterSdk(masterId)) {
      res.status(400).json({ error: 'Conecte a conta Bullex antes de iniciar o robô.' });
      return;
    }
    const result = await autoRobotService.start(masterId, {
      mode:        req.body.mode,
      stake:       req.body.stake,
      stopWin:     req.body.stopWin,
      stopLoss:    req.body.stopLoss,
      accountType: req.body.accountType,
    });
    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, 'robot/start error');
    res.status(500).json({ error: err.message ?? 'Erro ao iniciar robô' });
  }
});

router.post('/robot/stop', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(400).json({ error: 'Sessão inválida' }); return; }
    await autoRobotService.stop(masterId);
    res.json({ running: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Dashboard state ──────────────────────────────────────────────────────────

router.get('/status', async (req: AuthRequest, res: Response) => {
  const masterId = await resolveMasterId(req);
  if (masterId) await accountService.ensureMasterSessionsForToday(masterId);
  const master   = masterId ? accountService.getMasterInfo(masterId) : null;

  const dbMaster = masterId
    ? await prisma.masterAccount.findUnique({ where: { id: masterId } })
    : null;

  const masterInfo = master ?? (dbMaster ? {
    id: dbMaster.id, name: dbMaster.name, email: dbMaster.bullexEmail,
    balanceReal: dbMaster.balanceReal, balanceDemo: dbMaster.balanceDemo,
    currency: dbMaster.currency, isConnected: dbMaster.isConnected,
    copyRunning: dbMaster.copyRunning,
  } : null);

  const dbFollowers = masterId
    ? await prisma.followerAccount.findMany({ where: { masterId }, orderBy: { createdAt: 'asc' } })
    : [];

  const followers = dbFollowers.map((f) => {
    const live = accountService.getFollower(f.id);
    return live ?? {
      id: f.id, name: f.name, email: f.bullexEmail,
      balanceReal: f.balanceReal, balanceDemo: f.balanceDemo, currency: f.currency,
      isConnected: false,
      copySettings: {
        mode: f.copyMode.toLowerCase(),
        amount: f.copyAmount,
        accountType: f.accountType.toLowerCase(),
        isActive: f.isActive,
        stopWin: f.stopWin,
        stopLoss: f.stopLoss,
      },
      sessionStats: {
        wins: f.wins,
        losses: f.losses,
        totalTrades: f.totalTrades,
        profit: f.profit,
        startedAt: f.sessionStartedAt?.toISOString(),
      },
    };
  });

  // Recent trades da sessão do dashboard (sem apagar histórico geral)
  const dashboardStartedAt = dbMaster?.dashboardSessionStartedAt ?? null;
  const trades = masterId
    ? await prisma.trade.findMany({
      where: {
        masterId,
        ...(dashboardStartedAt ? { openedAt: { gte: dashboardStartedAt } } : {}),
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    })
    : [];

  // sdkConnected = SDK is live in memory (not just in DB)
  const sdkConnected = masterId ? accountService.getMasterSdk(masterId) !== null : false;

  let planBlock: Record<string, unknown> | null = null;
  if (masterId) {
    try {
      const { plan, spec } = await planService.getPlanForMasterId(masterId);
      const fc = await planService.getFollowerCount(masterId);
      const max = spec.maxFollowers;
      planBlock = {
        tier: plan,
        name: spec.name,
        emoji: spec.emoji,
        suggestedLimitLabel: spec.suggestedLimitLabel,
        maxFollowers: max,
        followerCount: fc,
        followerSlotsRemaining: max === null ? null : Math.max(0, max - fc),
        features: spec.features,
      };
    } catch {
      const u = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { subscriptionPlan: true },
      });
      if (u) {
        const spec = planService.spec(u.subscriptionPlan);
        planBlock = {
          tier: u.subscriptionPlan,
          name: spec.name,
          emoji: spec.emoji,
          suggestedLimitLabel: spec.suggestedLimitLabel,
          maxFollowers: spec.maxFollowers,
          followerCount: 0,
          followerSlotsRemaining: spec.maxFollowers,
          features: spec.features,
        };
      }
    }
  }

  const portalUser = await prisma.user.findUnique({
    where:  { id: req.user!.userId },
    select: { portalSlug: true },
  });
  const portalSegment = portalUser?.portalSlug ?? masterId ?? null;
  const portalPath    = portalSegment ? `/portal/${portalSegment}` : null;

  const robotRunning = masterId ? autoRobotService.isRunning(masterId) : false;
  const robotEndsAt  = dbMaster?.robotEndsAt?.toISOString() ?? null;

  res.json({
    master:       masterInfo,
    sdkConnected,
    copyRunning:  masterId ? copyTradeService.isRunning(masterId) : false,
    robotRunning,
    robotEndsAt,
    followers,
    trades,
    plan:         planBlock,
    portalSlug:   portalUser?.portalSlug ?? null,
    portalPath,
  });
});

// ─── Followers CRUD ───────────────────────────────────────────────────────────

const addFollowerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  copySettings: z.object({
    mode:        z.enum(['fixed', 'multiplier', 'proportional']).default('fixed'),
    amount:      z.number().min(0).default(5),
    accountType: z.enum(['real', 'demo']).default('real'),
    isActive:    z.boolean().default(true),
    stopWin:     z.number().nullable().optional(),
    stopLoss:    z.number().nullable().optional(),
  }).optional(),
});

router.post('/followers', validate(addFollowerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(400).json({ error: 'Conta master não conectada' }); return; }

    const { email, password, copySettings } = req.body;
    const emailNorm = String(email).trim().toLowerCase();
    const already = await prisma.followerAccount.findUnique({
      where: { masterId_bullexEmail: { masterId, bullexEmail: emailNorm } },
    });
    if (!already) {
      try {
        await planService.assertCanAddFollower(masterId);
      } catch (e: any) {
        res.status(403).json({ error: e.message ?? 'Limite do plano' });
        return;
      }
    }

    const settings = {
      mode:        copySettings?.mode        ?? 'fixed',
      amount:      copySettings?.amount      ?? 5,
      accountType: 'real' as const,
      isActive:    copySettings?.isActive    ?? false,
      stopWin:     copySettings?.stopWin     ?? null,
      stopLoss:    copySettings?.stopLoss    ?? null,
    };

    const follower = await accountService.addFollower(masterId, emailNorm, password, settings);
    res.status(201).json(follower);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to add follower');
    res.status(400).json({ error: err.message });
  }
});

const updateFollowerSchema = z.object({
  mode:        z.enum(['fixed', 'multiplier', 'proportional']).optional(),
  amount:      z.number().min(0).optional(),
  accountType: z.enum(['real', 'demo']).optional(),
  isActive:    z.boolean().optional(),
  stopWin:     z.number().nullable().optional(),
  stopLoss:    z.number().nullable().optional(),
});

router.patch('/followers/:id', validate(updateFollowerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(403).json({ error: 'Sem permissão' }); return; }

    const follower = await prisma.followerAccount.findFirst({ where: { id: req.params.id, masterId } });
    if (!follower) { res.status(404).json({ error: 'Seguidor não encontrado' }); return; }

    if (req.body.isActive !== undefined) {
      res.status(403).json({
        error: 'A ativação do copy é exclusiva do seguidor no portal.',
      });
      return;
    }

    const updated = await accountService.updateFollowerSettings(req.params.id, req.body);
    res.json(updated ?? follower);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/followers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const masterId = await resolveMasterId(req);
    if (!masterId) { res.status(403).json({ error: 'Sem permissão' }); return; }

    const follower = await prisma.followerAccount.findFirst({ where: { id: req.params.id, masterId } });
    if (!follower) { res.status(404).json({ error: 'Seguidor não encontrado' }); return; }

    await accountService.removeFollower(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
