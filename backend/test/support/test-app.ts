import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { UserEntity } from '../../src/user/entities/user.entity';
import { resetDatabase } from './database';
import { OutboundHttp } from './outbound';

export type ApiResponse<T = unknown> = { status: number; body: T };

/** The parts of the user a token is built from (same fields as a real login). */
type TokenUser = Pick<UserEntity, 'id' | 'email' | 'full_name' | 'role' | 'phone'> &
  Partial<Pick<UserEntity, 'personal_teacher_enabled'>>;

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  outbound: OutboundHttp;
  /** Calls `/api/v1<path>` on the running app. */
  api: {
    get: <T = unknown>(path: string, token?: string) => Promise<ApiResponse<T>>;
    post: <T = unknown>(path: string, body?: unknown, token?: string) => Promise<ApiResponse<T>>;
    request: <T = unknown>(method: string, path: string, options?: { body?: unknown; token?: string; form?: Record<string, string> }) => Promise<ApiResponse<T>>;
  };
  /** A signed access token with the same payload a real individual login produces. */
  tokenFor: (user: TokenUser) => string;
  close: () => Promise<void>;
}

/**
 * Boots the real AppModule against the test databases, with the production request
 * pipeline (configureApp) and all outbound HTTP blocked. Each call starts from an empty
 * database (apart from migrations and the seeded plans) and empty Redis/Mongo.
 */
export async function createTestApp(): Promise<TestApp> {
  await resetDatabase();
  const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT), lazyConnect: true });
  await redis.connect();
  await redis.flushdb();
  redis.disconnect();

  const outbound = new OutboundHttp();
  outbound.install();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const baseUrl = `${await app.getUrl()}/api/v1`.replace('[::1]', '127.0.0.1');

  const request = async <T>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; form?: Record<string, string> } = {},
  ): Promise<ApiResponse<T>> => {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(options.form).toString();
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const response = await fetch(`${baseUrl}${path}`, { method, headers, body, redirect: 'manual' });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON (e.g. a redirect page); keep the text.
    }
    return { status: response.status, body: parsed as T };
  };

  const jwt = new JwtService({ secret: process.env.JWT_SECRET });

  return {
    app,
    dataSource: app.get(DataSource),
    outbound,
    api: {
      get: (path, token) => request('GET', path, { token }),
      post: (path, body, token) => request('POST', path, { body, token }),
      request,
    },
    tokenFor: (user) =>
      jwt.sign(
        {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          phone: user.phone,
          personal_teacher_enabled: Boolean(user.personal_teacher_enabled),
          context_type: 'individual',
          session_mode: 'individual',
        },
        { expiresIn: '30m' },
      ),
    close: async () => {
      await app.close();
      jest.restoreAllMocks();
    },
  };
}
