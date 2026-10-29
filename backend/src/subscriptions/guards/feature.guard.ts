import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { REQUIRED_FEATURE } from '../decorators/requires-feature.decorator';
import { EntitlementsService } from '../entitlements.service';

/** Enforces @RequiresFeature against the request's workspace (see the decorator). */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    await this.entitlements.assertFeature(TenantContext.requireOrganizationId(), feature);
    return true;
  }
}
