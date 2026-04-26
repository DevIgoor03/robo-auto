import { Queue, Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface CopyTradeJob {
  masterId:       string;
  followerId:     string;
  masterTradeId:  string;
  activeId:       number;
  activeName:     string;
  direction:      string;
  masterAmount:   number;
  instrumentType: string;
}

export interface TradeResolveJob {
  tradeId:     string;
  followerId:  string | null;
  closeReason: string;
  pnlRealized: number | undefined;
  invest:      number;
  externalId:  number;
}

// Parse Redis URL for BullMQ (which bundles its own ioredis)
function parseRedisConnection(redisUrl: string): { host: string; port: number; password?: string } {
  try {
    const url = new URL(redisUrl);
    return {
      host:     url.hostname,
      port:     parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

class QueueService {
  private copyQueue:    Queue | null = null;
  private resolveQueue: Queue | null = null;
  private copyWorker:   Worker | null = null;
  private resolveWorker:Worker | null = null;

  async init(): Promise<void> {
    const connection = parseRedisConnection(config.redis.url);

    this.copyQueue = new Queue<CopyTradeJob>('copy-trades', {
      connection,
      defaultJobOptions: {
        attempts:    3,
        backoff:     { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail:     50,
      },
    });

    this.resolveQueue = new Queue<TradeResolveJob>('resolve-trades', {
      connection: { ...connection },
      defaultJobOptions: {
        attempts: 3,
        backoff:  { type: 'fixed', delay: 500 },
        removeOnComplete: 200,
        removeOnFail:     50,
      },
    });

    logger.info('BullMQ queues initialized');
  }

  getCopyQueue():    Queue<CopyTradeJob>    | null { return this.copyQueue; }
  getResolveQueue(): Queue<TradeResolveJob> | null { return this.resolveQueue; }

  async addCopyJob(data: CopyTradeJob): Promise<void> {
    if (!this.copyQueue) {
      logger.warn('Copy queue not available — executing directly');
      return;
    }
    await this.copyQueue.add('copy', data, { priority: 1 });
  }

  async addResolveJob(data: TradeResolveJob): Promise<void> {
    if (!this.resolveQueue) return;
    await this.resolveQueue.add('resolve', data);
  }

  async getStats(): Promise<Record<string, any>> {
    if (!this.copyQueue || !this.resolveQueue) return { available: false };
    const [copyWaiting, copyActive, copyFailed] = await Promise.all([
      this.copyQueue.getWaitingCount(),
      this.copyQueue.getActiveCount(),
      this.copyQueue.getFailedCount(),
    ]);
    const [resolveWaiting, resolveActive] = await Promise.all([
      this.resolveQueue.getWaitingCount(),
      this.resolveQueue.getActiveCount(),
    ]);
    return {
      available: true,
      copy:    { waiting: copyWaiting,    active: copyActive,    failed: copyFailed },
      resolve: { waiting: resolveWaiting, active: resolveActive },
    };
  }

  async shutdown(): Promise<void> {
    await this.copyWorker?.close();
    await this.resolveWorker?.close();
    await this.copyQueue?.close();
    await this.resolveQueue?.close();
    logger.info('BullMQ queues closed');
  }
}

export const queueService = new QueueService();
