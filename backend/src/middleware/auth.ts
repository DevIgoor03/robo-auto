import { Request, Response, NextFunction } from 'express';
import { authService, JwtPayload } from '../services/AuthService.js';
import { logger } from '../utils/logger.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de acesso não fornecido' });
    return;
  }

  const token = header.slice(7);
  try {
    req.user = authService.verifyAccess(token);
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
    } else {
      logger.warn({ err: err.message }, 'Invalid JWT');
      res.status(401).json({ error: 'Token inválido' });
    }
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Acesso negado — requer permissão de admin' });
      return;
    }
    next();
  });
}

/** Painel master / copy trading — contas ADMIN não acessam estes endpoints. */
export function requireMaster(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'MASTER') {
    res.status(403).json({ error: 'Apenas contas master podem acessar este recurso.' });
    return;
  }
  next();
}

// ─── Portal token middleware ──────────────────────────────────────────────────

export interface PortalRequest extends Request {
  followerId?: string;
  masterId?:   string;
}

import { prisma } from '../database/prisma.js';

export async function requirePortalToken(req: PortalRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['x-portal-token'] as string | undefined;
  if (!token) { res.status(401).json({ error: 'Token não fornecido' }); return; }

  try {
    const session = await prisma.portalSession.findUnique({
      where:   { token },
      include: { follower: { select: { id: true, masterId: true, bullexEmail: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.portalSession.delete({ where: { id: session.id } });
      res.status(401).json({ error: 'Sessão expirada' });
      return;
    }

    const portalEmail = session.follower.bullexEmail.trim().toLowerCase();
    const stillAllowed = await prisma.followerPortalAllowlist.findUnique({
      where: {
        masterId_bullexEmail: { masterId: session.follower.masterId, bullexEmail: portalEmail },
      },
    });
    if (!stillAllowed) {
      await prisma.portalSession.deleteMany({ where: { token } });
      res.status(403).json({
        error: 'Acesso ao portal revogado. Contacte o suporte.',
        code: 'PORTAL_ALLOWLIST_REVOKED',
      });
      return;
    }

    req.followerId = session.followerId;
    req.masterId   = session.follower.masterId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
}
