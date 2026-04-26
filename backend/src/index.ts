import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { config }         from './config.js';
import { logger }         from './utils/logger.js';
import { prisma, connectDb, disconnectDb } from './database/prisma.js';
import { connectRedis, getRedis, isRedisAvailable } from './utils/redis.js';

import { accountService }   from './services/AccountService.js';
import { copyTradeService } from './services/CopyTradeService.js';
import { autoRobotService }  from './services/AutoRobotService.js';
import { queueService }     from './services/QueueService.js';
import { authService }      from './services/AuthService.js';

import { apiLimiter }  from './middleware/rateLimiter.js';
import { requireAuth, AuthRequest } from './middleware/auth.js';

import authRoutes      from './routes/auth.js';
import accountRoutes   from './routes/accounts.js';
import tradeRoutes     from './routes/trades.js';
import portalRoutes    from './routes/portal.js';
import adminMastersRoutes from './routes/adminMasters.js';

async function bootstrap() {
  // ─── HTTP + Express ────────────────────────────────────────────────────────
  const app    = express();
  const server = http.createServer(app);

  // Nginx/proxy (Docker) envia X-Forwarded-For — necessário para req.ip e express-rate-limit
  if (!config.server.isDev) {
    app.set('trust proxy', 1);
  }

  // ─── Security middleware ───────────────────────────────────────────────────
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin:      [...config.server.frontendOrigins, /localhost:\d+$/],
    credentials: true,
    methods:     ['GET','POST','PATCH','DELETE','OPTIONS'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  // ─── Redis ────────────────────────────────────────────────────────────────
  const redis = await connectRedis();

  // ─── Socket.IO ────────────────────────────────────────────────────────────
  const io = new SocketServer(server, {
    cors: {
      origin:      [...config.server.frontendOrigins, /localhost:\d+$/],
      credentials: true,
      methods:     ['GET','POST'],
    },
    pingTimeout:  30000,
    pingInterval: 10000,
  });

  // Use Redis adapter for horizontal scaling (optional)
  if (redis && isRedisAvailable()) {
    const pubClient = redis;
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter active');
  }

  // Socket.IO auth: JWT (master/dashboard) ou portalToken (seguidor no /portal)
  io.use(async (socket, next) => {
    const portalToken = socket.handshake.auth?.portalToken as string | undefined;
    if (portalToken) {
      try {
        const session = await prisma.portalSession.findUnique({
          where:   { token: portalToken },
          include: { follower: { select: { id: true, masterId: true, bullexEmail: true } } },
        });
        if (!session || session.expiresAt < new Date()) {
          if (session) await prisma.portalSession.delete({ where: { id: session.id } });
          next(new Error('Sessão do portal inválida ou expirada'));
          return;
        }
        const portalEmail = session.follower.bullexEmail.trim().toLowerCase();
        const stillAllowed = await prisma.followerPortalAllowlist.findUnique({
          where: {
            masterId_bullexEmail: { masterId: session.follower.masterId, bullexEmail: portalEmail },
          },
        });
        if (!stillAllowed) {
          await prisma.portalSession.deleteMany({ where: { token: portalToken } });
          next(new Error('Acesso ao portal revogado'));
          return;
        }
        (socket as any).portalFollowerId = session.followerId;
        next();
      } catch (err: any) {
        next(new Error(err?.message ?? 'Falha na autenticação do portal'));
      }
      return;
    }

    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Token não fornecido'));
      return;
    }
    try {
      const payload = authService.verifyAccess(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    const portalFollowerId = (socket as any).portalFollowerId as string | undefined;
    if (user?.masterId) {
      socket.join(`master:${user.masterId}`);
      logger.debug({ socketId: socket.id, masterId: user.masterId }, 'Socket joined master room');
    }
    if (portalFollowerId) {
      socket.join(`follower:${portalFollowerId}`);
      logger.debug({ socketId: socket.id, followerId: portalFollowerId }, 'Socket joined follower room (portal)');
    }
    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  accountService.setSocketServer(io);
  copyTradeService.setSocketServer(io);
  autoRobotService.setSocketServer(io);

  // ─── Database ─────────────────────────────────────────────────────────────
  await connectDb();
  await authService.ensureInitialSuperAdmin();

  // ─── BullMQ (only with Redis) ─────────────────────────────────────────────
  if (redis) {
    await queueService.init();
  }

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth',      apiLimiter, authRoutes);
  app.use('/api/accounts',  apiLimiter, accountRoutes);
  app.use('/api/trades',    apiLimiter, tradeRoutes);
  app.use('/api/portal',    apiLimiter, portalRoutes);
  app.use('/api/admin',     apiLimiter, adminMastersRoutes);

  // Health check
  app.get('/api/health', async (_req, res) => {
    const queue = await queueService.getStats();
    res.json({
      status:     'ok',
      time:       new Date().toISOString(),
      redis:      isRedisAvailable(),
      queue,
    });
  });

  // Queue stats (authenticated)
  app.get('/api/admin/queue-stats', requireAuth as any, async (_req: AuthRequest, res) => {
    if (_req.user?.role !== 'ADMIN') { res.status(403).json({ error: 'Admin only' }); return; }
    res.json(await queueService.getStats());
  });

  // 404 handler
  app.use((_req, res) => { res.status(404).json({ error: 'Rota não encontrada' }); });

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: config.server.isDev ? err.message : 'Erro interno do servidor' });
  });

  // ─── Restore connections ───────────────────────────────────────────────────
  logger.info('A restaurar ligações a partir da base de dados...');
  await accountService.restoreFromDb().catch((err) => logger.error({ err }, 'Restore failed'));

  // ─── Start listening ───────────────────────────────────────────────────────
  server.listen(config.server.port, () => {
    logger.info(
      { port: config.server.port },
      `API Robô Auto a ouvir (PORT=${process.env.PORT ?? '3001'})`,
    );
    logger.info({ origins: config.server.frontendOrigins }, 'CORS / Socket.IO origins');
    if (isRedisAvailable()) logger.info('Redis ligado — Socket.IO com adapter');
  });

  // ─── Scheduled tasks ──────────────────────────────────────────────────────
  setInterval(() => authService.cleanExpiredSessions(), 60 * 60 * 1000); // every hour

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await queueService.shutdown();
    await disconnectDb();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
