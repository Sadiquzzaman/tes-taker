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
    const required = this.reflector.getAllAndOverride<string | string[] | undefined>(REQUIRED_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const features = (Array.isArray(required) ? required : required ? [required] : []).filter(Boolean);
    if (features.length === 0) return true;

    // Any one of the features is enough; when none is on, the first one's check gives the 403.
    const organizationId = TenantContext.requireOrganizationId();
    for (const feature of features.slice(1)) {
      if (await this.entitlements.hasFeature(organizationId, feature)) return true;
    }
    await this.entitlements.assertFeature(organizationId, features[0]);
    return true;
  }
}
