import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { FeatureKey } from '../constants/feature-catalog';
import { RequiresFeature } from '../decorators/requires-feature.decorator';
import { FEATURE_NOT_IN_PLAN, FeatureNotInPlanException } from '../entitlements.service';
import { FeatureGuard } from './feature.guard';

/** @RequiresFeature (design §8.3): 403 FEATURE_NOT_IN_PLAN when the workspace's plan lacks the feature. */
describe('FeatureGuard', () => {
  const ORG_ID = '88888888-8888-4888-8888-888888888888';

  class Routes {
    @RequiresFeature(FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT)
    gated() {}

    open() {}
  }

  const contextFor = (handler: keyof Routes) =>
    ({ getHandler: () => Routes.prototype[handler], getClass: () => Routes }) as unknown as ExecutionContext;

  const inWorkspace = <T>(work: () => Promise<T>) =>
    TenantContext.run(() => {
      TenantContext.set({ organizationId: ORG_ID, kind: OrganizationKindEnum.SOLO, memberRole: OrganizationMemberRoleEnum.OWNER });
      return work();
    });

  const guardWith = (hasFeature: boolean) => {
    const entitlements = {
      assertFeature: jest.fn(async (_org: string, key: string) => {
        if (!hasFeature) throw new FeatureNotInPlanException(key);
      }),
    };
    return { guard: new FeatureGuard(new Reflector(), entitlements as never), entitlements };
  };

  it('lets routes without the decorator through without looking up the plan', async () => {
    const { guard, entitlements } = guardWith(false);
    await expect(inWorkspace(() => guard.canActivate(contextFor('open')))).resolves.toBe(true);
    expect(entitlements.assertFeature).not.toHaveBeenCalled();
  });

  it("checks the feature against the request's workspace", async () => {
    const { guard, entitlements } = guardWith(true);
    await expect(inWorkspace(() => guard.canActivate(contextFor('gated')))).resolves.toBe(true);
    expect(entitlements.assertFeature).toHaveBeenCalledWith(ORG_ID, FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT);
  });

  it('refuses with FEATURE_NOT_IN_PLAN when the plan lacks it', async () => {
    const { guard } = guardWith(false);
    const error = await inWorkspace(() => guard.canActivate(contextFor('gated'))).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: FEATURE_NOT_IN_PLAN,
      feature: FeatureKey.ALLOW_QUESTION_IMPORT_EXPORT,
    });
  });

  it('refuses when no workspace is chosen', async () => {
    const { guard } = guardWith(true);
    await expect(TenantContext.run(() => guard.canActivate(contextFor('gated')))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
