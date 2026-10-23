import { Controller, ExecutionContext, HttpStatus, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerException, ThrottlerModuleOptions, ThrottlerStorageService } from '@nestjs/throttler';
import { AUTH_IP_THROTTLER, AuthThrottle, isAuthThrottled } from '../decorators/auth-throttle.decorator';
import { AppThrottlerGuard } from './app-throttler.guard';

const SECRET = 'unit-test-secret';

@Controller()
class TestController {
  @Post('login')
  @AuthThrottle({ fields: ['phone', 'email'], perIdentifier: 3, perIp: 5 })
  login() {}

  @Post('exam')
  @Throttle({ default: { ttl: 60000, limit: 2 } })
  exam() {}
}

type Req = { ip: string; headers: Record<string, string>; body?: Record<string, unknown> };

function contextFor(handler: keyof TestController, req: Req): ExecutionContext {
  const res = { header: jest.fn() };
  return {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('AppThrottlerGuard', () => {
  const jwt = new JwtService({ secret: SECRET });
  const forger = new JwtService({ secret: 'attacker-guess' });
  let storage: ThrottlerStorageService;
  let guard: AppThrottlerGuard;
  let tracker: (req: Req) => Promise<string>;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    const options: ThrottlerModuleOptions = {
      throttlers: [
        { name: 'default', ttl: 60000, limit: 300 },
        {
          name: AUTH_IP_THROTTLER,
          ttl: 60000,
          limit: 300,
          skipIf: (context) => !isAuthThrottled(context),
          getTracker: (req) => req.ip,
        },
      ],
    };
    guard = new AppThrottlerGuard(options, storage, new Reflector(), jwt);
    await guard.onModuleInit();
    tracker = (req) => (guard as unknown as { getTracker(r: Req): Promise<string> }).getTracker(req);
  });

  afterEach(() => storage.onApplicationShutdown());

  describe('tracker for authenticated routes', () => {
    const ip = '203.0.113.7';
    const bearer = (token: string): Req => ({ ip, headers: { authorization: `Bearer ${token}` } });

    it('uses the user id from a verified token', async () => {
      await expect(tracker(bearer(jwt.sign({ id: 'real-user' })))).resolves.toBe('user:real-user');
    });

    it('ignores a token signed with another secret', async () => {
      await expect(tracker(bearer(forger.sign({ id: 'victim' })))).resolves.toBe(ip);
    });

    it('ignores an unsigned (alg none) token', async () => {
      const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id: 'victim' })}.`;
      await expect(tracker(bearer(token))).resolves.toBe(ip);
    });

    it('ignores an expired token', async () => {
      const token = jwt.sign({ id: 'real-user', exp: Math.floor(Date.now() / 1000) - 60 });
      await expect(tracker(bearer(token))).resolves.toBe(ip);
    });

    it('ignores garbage and missing headers', async () => {
      await expect(tracker(bearer('not-a-jwt'))).resolves.toBe(ip);
      await expect(tracker({ ip, headers: {} })).resolves.toBe(ip);
    });
  });

  describe('login route (IP + identifier)', () => {
    const ip = '198.51.100.20';
    const loginAs = (phone: string, token?: string): Req => ({
      ip,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: { phone, password: 'x' },
    });

    it('a new forged token per request does not reset the limit', async () => {
      for (let i = 0; i < 3; i++) {
        const forged = forger.sign({ id: `fake-${i}` });
        await expect(guard.canActivate(contextFor('login', loginAs('01700000001', forged)))).resolves.toBe(true);
      }
      const error = await guard
        .canActivate(contextFor('login', loginAs('01700000001', forger.sign({ id: 'fake-99' }))))
        .catch((e) => e);
      expect(error).toBeInstanceOf(ThrottlerException);
      expect((error as ThrottlerException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('a valid token also does not change the login key', async () => {
      for (let i = 0; i < 3; i++) {
        await guard.canActivate(contextFor('login', loginAs('01700000001', jwt.sign({ id: `user-${i}` }))));
      }
      await expect(
        guard.canActivate(contextFor('login', loginAs('01700000001', jwt.sign({ id: 'user-x' })))),
      ).rejects.toBeInstanceOf(ThrottlerException);
    });

    it('students behind one IP get their own buckets, up to the per-IP cap', async () => {
      // perIp is 5 in this test controller: 5 different students pass, the 6th IP request is capped.
      for (let i = 0; i < 5; i++) {
        await expect(
          guard.canActivate(contextFor('login', loginAs(`0170000000${i}`))),
        ).resolves.toBe(true);
      }
      await expect(guard.canActivate(contextFor('login', loginAs('01799999999')))).rejects.toBeInstanceOf(
        ThrottlerException,
      );
    });

    it('identifier matching is case-insensitive', async () => {
      const req = (email: string): Req => ({ ip, headers: {}, body: { email, password: 'x' } });
      for (let i = 0; i < 3; i++) {
        await guard.canActivate(contextFor('login', req(i % 2 ? 'A@Example.com' : 'a@example.com ')));
      }
      await expect(guard.canActivate(contextFor('login', req('A@EXAMPLE.COM')))).rejects.toBeInstanceOf(
        ThrottlerException,
      );
    });
  });

  describe('non-auth route', () => {
    it('keys verified users separately even behind one IP', async () => {
      const ip = '192.0.2.50';
      for (let student = 0; student < 10; student++) {
        const token = jwt.sign({ id: `student-${student}` });
        for (let i = 0; i < 2; i++) {
          await expect(
            guard.canActivate(contextFor('exam', { ip, headers: { authorization: `Bearer ${token}` } })),
          ).resolves.toBe(true);
        }
      }
    });

    it('forged tokens fall back to the shared IP bucket', async () => {
      const ip = '192.0.2.51';
      const forged = (n: number): Req => ({ ip, headers: { authorization: `Bearer ${forger.sign({ id: `f${n}` })}` } });
      await guard.canActivate(contextFor('exam', forged(1)));
      await guard.canActivate(contextFor('exam', forged(2)));
      await expect(guard.canActivate(contextFor('exam', forged(3)))).rejects.toBeInstanceOf(ThrottlerException);
    });
  });
});
