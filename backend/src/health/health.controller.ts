import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../config/redis.service';

type DependencyStatus = 'up' | 'down';

@ApiTags('Health')
@Controller()
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Service health check',
    description:
      'Reports application status, version, uptime, dependency health (PostgreSQL, Redis), memory usage and environment. Returns 503 when a critical dependency is unavailable. No secrets are ever exposed.',
  })
  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isHealthy = database === 'up' && redis === 'up';

    const memory = process.memoryUsage();
    const payload = {
      status: isHealthy ? 'ok' : 'degraded',
      version: process.env.npm_package_version ?? '1.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
      memory: {
        rss_mb: this.toMb(memory.rss),
        heapUsed_mb: this.toMb(memory.heapUsed),
        heapTotal_mb: this.toMb(memory.heapTotal),
      },
    };

    if (!isHealthy) {
      // Surface a 503 so Docker/orchestrators mark the container unhealthy,
      // while still returning the detailed payload for debugging.
      throw new ServiceUnavailableException(payload);
    }

    return { message: 'Service is healthy', payload };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      return (await this.redisService.ping()) ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private toMb(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }
}
