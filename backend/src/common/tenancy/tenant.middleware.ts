import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContext } from './tenant-context';

/** Opens the per-request tenant store that OrganizationContextGuard fills in. */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_request: unknown, _response: unknown, next: () => void): void {
    TenantContext.run(next);
  }
}
