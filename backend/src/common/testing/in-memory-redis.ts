/**
 * Test double for RedisService: an in-memory key/value store whose expiries
 * follow Date.now(), so specs can move time with jest fake timers.
 */
export class InMemoryRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  private live(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async set(key: string, value: string, expirationSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: expirationSeconds ? Date.now() + expirationSeconds * 1000 : null,
    });
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async incrWithTtl(key: string, expirationSeconds: number): Promise<number> {
    const entry = this.live(key);
    const count = (entry ? parseInt(entry.value, 10) : 0) + 1;
    this.store.set(key, {
      value: String(count),
      expiresAt: entry ? entry.expiresAt : Date.now() + expirationSeconds * 1000,
    });
    return count;
  }

  async expire(key: string, expirationSeconds: number): Promise<void> {
    const entry = this.live(key);
    if (entry) entry.expiresAt = Date.now() + expirationSeconds * 1000;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.live(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  /** Supports the `*` wildcard only, like the patterns the services use. */
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return [...this.store.keys()].filter((key) => this.live(key) && regex.test(key));
  }

  async delMultiple(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) deleted += await this.del(key);
    return deleted;
  }
}
