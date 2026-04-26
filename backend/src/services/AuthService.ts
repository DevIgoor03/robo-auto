import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { CopyPlan } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface JwtPayload {
  userId:   string;
  masterId: string | null;
  role:     string;
  email:    string;
}

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    string;
}

export class AuthService {

  // ─── Password ────────────────────────────────────────────────────────────────

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ─── JWT ──────────────────────────────────────────────────────────────────────

  generateTokenPair(payload: JwtPayload): TokenPair {
    const accessToken  = jwt.sign(payload, config.jwt.secret,        { expiresIn: config.jwt.expiresIn as any });
    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret,  { expiresIn: config.jwt.refreshExpiresIn as any });
    return { accessToken, refreshToken, expiresIn: config.jwt.expiresIn };
  }

  verifyAccess(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }

  verifyRefresh(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  }

  // ─── Register / Login ─────────────────────────────────────────────────────────

  /** Cria usuário painel master (sem conta Bullex) — apenas super admin. */
  async createMasterUser(
    email: string,
    password: string,
    name: string,
    subscriptionPlan: CopyPlan = CopyPlan.START
  ): Promise<{ id: string; email: string; name: string; role: string; subscriptionPlan: CopyPlan; createdAt: Date }> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('Email já cadastrado');

    const passwordHash = await this.hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: 'MASTER', subscriptionPlan },
      select: { id: true, email: true, name: true, role: true, subscriptionPlan: true, createdAt: true },
    });
    logger.info({ userId: user.id, email: user.email }, 'Master user created by admin');
    return user;
  }

  /** Primeiro acesso: cria super admin se não existir nenhum e as env vars estiverem definidas. */
  async ensureInitialSuperAdmin(): Promise<void> {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount > 0) return;

    const email    = process.env.INITIAL_ADMIN_EMAIL?.trim();
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    const name     = process.env.INITIAL_ADMIN_NAME?.trim() || 'Super Admin';

    if (!email || !password) {
      logger.warn('Nenhum usuário ADMIN no banco. Defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD no .env para criar o primeiro super admin automaticamente.');
      return;
    }

    const passwordHash = await this.hashPassword(password);
    await prisma.user.create({
      data: { email, passwordHash, name, role: 'ADMIN' },
    });
    logger.info({ email }, 'Super admin inicial criado a partir do .env');
  }

  async login(email: string, password: string, ip?: string, userAgent?: string): Promise<{ user: any; tokens: TokenPair }> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { masterAccount: { select: { id: true } } },
    });

    if (!user) throw new Error('Credenciais inválidas');
    if (!await this.verifyPassword(password, user.passwordHash)) throw new Error('Credenciais inválidas');

    const payload: JwtPayload = {
      userId:   user.id,
      masterId: user.masterAccount?.id ?? null,
      role:     user.role,
      email:    user.email,
    };

    const tokens  = this.generateTokenPair(payload);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save refresh token
    await prisma.refreshSession.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt: expires, ip, userAgent },
    });

    // Cleanup old sessions (keep max 5 per user)
    const sessions = await prisma.refreshSession.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    if (sessions.length > 5) {
      const toDelete = sessions.slice(0, sessions.length - 5).map((s) => s.id);
      await prisma.refreshSession.deleteMany({ where: { id: { in: toDelete } } });
    }

    const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    logger.info({ userId: user.id }, 'User logged in');
    return { user: safeUser, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.verifyRefresh(refreshToken);

    const session = await prisma.refreshSession.findUnique({ where: { token: refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.refreshSession.delete({ where: { id: session.id } });
      throw new Error('Refresh token inválido ou expirado');
    }

    const user = await prisma.user.findUnique({
      where:   { id: payload.userId },
      include: { masterAccount: { select: { id: true } } },
    });
    if (!user) throw new Error('Usuário não encontrado');

    const newPayload: JwtPayload = {
      userId:   user.id,
      masterId: user.masterAccount?.id ?? null,
      role:     user.role,
      email:    user.email,
    };

    const tokens  = this.generateTokenPair(newPayload);
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshSession.update({
      where: { id: session.id },
      data:  { token: tokens.refreshToken, expiresAt: expires },
    });

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshSession.deleteMany({ where: { token: refreshToken } });
  }

  async cleanExpiredSessions(): Promise<void> {
    const { count } = await prisma.refreshSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) logger.debug({ count }, 'Expired sessions cleaned');
  }
}

export const authService = new AuthService();
