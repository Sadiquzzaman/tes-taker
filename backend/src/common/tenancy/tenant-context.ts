import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { OrganizationKindEnum } from 'src/organizations/enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';

/** The organisation a request works in (design §8.1). */
export interface Tenant {
  organizationId: string;
  kind: OrganizationKindEnum;
  /**
   * The user's role in it. A student in a solo teacher's workspace has no membership; their
   * access is through enrolment in that teacher's classes, so this is STUDENT with `viaEnrolment`.
   */
  memberRole: OrganizationMemberRoleEnum;
  viaEnrolment?: boolean;
}

interface TenantStore {
  tenant: Tenant | null;
}

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * Request-scoped tenant, without making services request-scoped: TenantMiddleware opens a store
 * for every request and OrganizationContextGuard fills it in. Outside a request (jobs, scripts)
 * there is no tenant, so code there must pass the organisation explicitly.
 */
export const TenantContext = {
  /** Runs `fn` with an empty tenant store (used by the middleware and by tests). */
  run<T>(fn: () => T): T {
    return storage.run({ tenant: null }, fn);
  },

  /** Called by OrganizationContextGuard once the organisation is verified. */
  set(tenant: Tenant | null): void {
    const store = storage.getStore();
    if (store) store.tenant = tenant;
  },

  current(): Tenant | null {
    return storage.getStore()?.tenant ?? null;
  },

  /** The current organisation id, or 403 when the request has no workspace. */
  requireOrganizationId(): string {
    const tenant = storage.getStore()?.tenant;
    if (!tenant) {
      throw new ForbiddenException('Choose a workspace first');
    }
    return tenant.organizationId;
  },
};
