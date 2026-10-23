import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { RedisService } from '../config/redis.service';
import {
  WORKER_HEARTBEAT_EVERY_MS,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
} from '../queue/queue.constants';

/** Refreshes a short-lived Redis key; the container health check (worker-health.ts) reads it. */
@Injectable()
export class WorkerHeartbeatService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;

  constructor(private readonly redis: RedisService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.beat();
    this.timer = setInterval(() => void this.beat(), WORKER_HEARTBEAT_EVERY_MS);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    await this.redis.set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), WORKER_HEARTBEAT_TTL_SECONDS);
  }
}
