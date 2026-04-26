import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  handler: (req, res, _next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    res.status(429).json(options.message);
  },
});

// Strict limit for auth routes (login, register)
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas tentativas de autenticação. Aguarde 1 minuto.' },
  skipSuccessfulRequests: true,
});

// Portal login limit
export const portalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max:      config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Muitas tentativas. Aguarde 1 minuto.' },
  skipSuccessfulRequests: true,
});
