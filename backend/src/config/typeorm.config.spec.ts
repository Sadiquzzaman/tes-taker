import { buildTypeOrmOptions } from './typeorm.config';

describe('buildTypeOrmOptions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_SYNCRONIZE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when DATABASE_SYNCRONIZE=true in production so the schema is never auto-altered', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_SYNCRONIZE = 'true';
    expect(() => buildTypeOrmOptions()).toThrow(
      /DATABASE_SYNCRONIZE=true is not allowed when NODE_ENV=production/,
    );
  });

  it('starts in production with DATABASE_SYNCRONIZE=false', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_SYNCRONIZE = 'false';
    expect(buildTypeOrmOptions().synchronize).toBe(false);
  });

  it('defaults to synchronize off in production when DATABASE_SYNCRONIZE is unset', () => {
    process.env.NODE_ENV = 'production';
    expect(buildTypeOrmOptions().synchronize).toBe(false);
  });

  it('keeps synchronize on by default in development', () => {
    process.env.NODE_ENV = 'development';
    expect(buildTypeOrmOptions().synchronize).toBe(true);
  });
});
