import { Router, Response } from 'express';
import { prisma } from '../database/prisma.js';
import { requireAuth, requireMaster, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth as any);
router.use(requireMaster as any);

async function resolveMasterId(req: AuthRequest): Promise<string | null> {
  if (req.user!.masterId) return req.user!.masterId;
  const m = await prisma.masterAccount.findUnique({ where: { userId: req.user!.userId } });
  return m?.id ?? null;
}

// GET /api/trades — paginated trade history
router.get('/', async (req: AuthRequest, res: Response) => {
  const masterId = await resolveMasterId(req);
  if (!masterId) { res.status(400).json({ error: 'Nenhum master conectado' }); return; }

  const page       = Math.max(1, parseInt(req.query.page   as string ?? '1',  10));
  const limit      = Math.min(Math.max(1, parseInt(req.query.limit as string ?? '50', 10)), 200);
  const skip       = (page - 1) * limit;
  const followerId = req.query.followerId as string | undefined;
  const status     = req.query.status     as string | undefined;
  const search     = (req.query.search as string | undefined)?.trim();
  const from       = req.query.from as string | undefined;
  const to         = req.query.to as string | undefined;

  const where: any = { masterId };
  if (followerId === '__robot__')            where.followerId = null;
  else if (followerId)                       where.followerId = followerId;
  if (status && status !== 'all') where.status = status.toUpperCase();
  if (search) {
    where.OR = [
      { followerName:   { contains: search, mode: 'insensitive' } },
      { instrumentName: { contains: search, mode: 'insensitive' } },
      { direction:      { contains: search, mode: 'insensitive' } },
    ];
  }
  if (from || to) {
    where.openedAt = {};
    if (from) where.openedAt.gte = new Date(from);
    if (to) where.openedAt.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.trade.findMany({ where, orderBy: { openedAt: 'desc' }, take: limit, skip }),
    prisma.trade.count({ where }),
  ]);

  res.json({ trades: rows, total, page, pages: Math.ceil(total / limit) });
});

// GET /api/trades/summary
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const masterId = await resolveMasterId(req);
  if (!masterId) { res.status(400).json({ error: 'Nenhum master' }); return; }

  const [wins, losses, open] = await Promise.all([
    prisma.trade.count({ where: { masterId, status: 'WIN' } }),
    prisma.trade.count({ where: { masterId, status: 'LOSS' } }),
    prisma.trade.count({ where: { masterId, status: 'OPEN' } }),
  ]);

  const profitData = await prisma.trade.aggregate({
    where: { masterId, NOT: { status: 'OPEN' } },
    _sum:  { profit: true },
  });

  const totalProfit = profitData._sum?.profit ?? 0;

  res.json({
    wins, losses, open,
    totalClosed: wins + losses,
    totalProfit,
  });
});

export default router;
