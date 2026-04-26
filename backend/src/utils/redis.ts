import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function connectRedis(): Promise<Redis | null> {
  try {
    const client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000,
    });

    client.on('connect',    () => { redisAvailable = true;  logger.info('Redis connected'); });
    client.on('close',      () => { redisAvailable = false; logger.warn('Redis disconnected'); });
    client.on('error',      (err) => logger.error({ err }, 'Redis error'));
    client.on('ready',      () => { redisAvailable = true; });

    await client.connect();
    redisClient = client;
    return client;
  } catch (err) {
    logger.warn({ err }, 'Redis not available — running without Redis (no clustering/rate-limiting via Redis)');
    return null;
  }
}
