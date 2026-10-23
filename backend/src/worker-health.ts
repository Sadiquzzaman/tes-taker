import Redis from 'ioredis';
import { WORKER_HEARTBEAT_KEY } from './queue/queue.constants';

/** Container health check for the worker: healthy while its Redis heartbeat key exists. */
async function check(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    const alive = await redis.exists(WORKER_HEARTBEAT_KEY);
    process.exit(alive ? 0 : 1);
  } catch {
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}
void check();
