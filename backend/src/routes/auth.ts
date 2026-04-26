import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/AuthService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../utils/logger.js';

const router = Router();

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

// Cadastro público desativado: contas master são criadas apenas pelo super admin.
router.post('/register', authLimiter, (_req: Request, res: Response) => {
  res.status(403).json({
    error: 'Cadastro público desativado. Solicite suas credenciais ao administrador da plataforma.',
  });
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ip        = req.ip;
    const userAgent = req.headers['user-agent'];
    const { user, tokens } = await authService.login(email, password, ip, userAgent);
    res.json({ user, ...tokens });
  } catch (err: any) {
    logger.warn({ err: err.message, email: req.body.email }, 'Login failed');
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  try {
    const tokens = await authService.refresh(req.body.refreshToken);
    res.json(tokens);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prisma } = await import('../database/prisma.js');
    const user = await prisma.user.findUnique({
      where:   { id: req.user!.userId },
      select:  { id: true, email: true, name: true, role: true, createdAt: true,
                 masterAccount: { select: { id: true, name: true, bullexEmail: true, isConnected: true, copyRunning: true, balanceReal: true, balanceDemo: true, currency: true } } },
    });
    if (!user) { res.status(404).json({ error: 'Usuário não encontrado' }); return; }
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
