import { Logger } from '@nestjs/common';
import { basicAuth, mountBullBoard } from './bull-board';

const header = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

describe('bull-board basic auth', () => {
  const guard = basicAuth('ops', 'correct horse battery');

  const call = (authorization?: string) => {
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();
    guard({ headers: authorization ? { authorization } : {} } as never, res as never, next);
    return { res, next };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('lets the right username and password through', () => {
    const { res, next } = call(header('ops', 'correct horse battery'));

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong password', header('ops', 'guess')],
    ['wrong user', header('admin', 'correct horse battery')],
    ['not basic auth', 'Bearer some-token'],
  ])('refuses a %s after a delay', (_, authorization) => {
    const { res, next } = call(authorization);
    expect(res.status).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1_000);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('Basic'));
  });

  it('asks for a login straight away when no credentials were sent', () => {
    const { res } = call();
    jest.advanceTimersByTime(0);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('mountBullBoard', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  it('stays off when BULL_BOARD_USER or BULL_BOARD_PASSWORD is not set', () => {
    jest.spyOn(Logger, 'log').mockImplementation(() => undefined);
    delete process.env.BULL_BOARD_USER;
    process.env.BULL_BOARD_PASSWORD = 'set';
    const app = { use: jest.fn(), get: jest.fn() };

    expect(mountBullBoard(app as never)).toBe(false);
    expect(app.use).not.toHaveBeenCalled();
  });
});
