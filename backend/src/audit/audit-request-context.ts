import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, NestMiddleware } from '@nestjs/common';

interface AuditRequestStore {
  ip: string | null;
}

const storage = new AsyncLocalStorage<AuditRequestStore>();

/** The caller's IP for audit rows, without passing the request through every service. */
export const AuditRequestContext = {
  run<T>(store: AuditRequestStore, fn: () => T): T {
    return storage.run(store, fn);
  },

  ip(): string | null {
    return storage.getStore()?.ip ?? null;
  },
};

/** Remembers `req.ip` (the real client behind the proxy: main.ts sets `trust proxy`). */
@Injectable()
export class AuditRequestMiddleware implements NestMiddleware {
  use(request: { ip?: string }, _response: unknown, next: () => void): void {
    AuditRequestContext.run({ ip: request.ip ?? null }, next);
  }
}
