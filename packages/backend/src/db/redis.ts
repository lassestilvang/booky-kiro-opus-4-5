/**
 * Redis client singleton
 */
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

// Connect and log status
redis.connect().then(() => {
  logger.info('Redis connected');
}).catch((error: Error) => {
  logger.error({ error }, 'Redis connection failed');
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

export type { Redis };
