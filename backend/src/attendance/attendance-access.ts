import { ForbiddenException } from '@nestjs/common';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;

/** Owners and admins change organisation-wide attendance settings and branches. */
export const ATTENDANCE_MANAGERS = [OWNER, ADMIN];
/** Staff of the workspace read them. */
export const ATTENDANCE_STAFF = [OWNER, ADMIN, ASSISTANT, TEACHER];

/** The request's tenant when the member has one of these roles (a solo teacher is OWNER of their own workspace). */
export function requireAttendanceRole(roles: OrganizationMemberRoleEnum[], message: string): Tenant {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  if (tenant.viaEnrolment || !roles.includes(tenant.memberRole)) throw new ForbiddenException(message);
  return tenant;
}
