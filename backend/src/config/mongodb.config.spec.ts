import { ConfigService } from '@nestjs/config';
import { getMongoUri } from './mongodb.config';

describe('getMongoUri', () => {
  it('throws when MONGODB_URI is missing so the app does not fall back to PostgreSQL', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    expect(() => getMongoUri(config)).toThrow(/MONGODB_URI is required/);
  });

  it('returns the configured URI', () => {
    const config = {
      get: jest.fn().mockReturnValue('mongodb://localhost:27017/tasktaker_chat'),
    } as unknown as ConfigService;
    expect(getMongoUri(config)).toBe('mongodb://localhost:27017/tasktaker_chat');
  });
});
