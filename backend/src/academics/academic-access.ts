import { ForbiddenException } from '@nestjs/common';
import { Tenant, TenantContext } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';

const { OWNER, ADMIN, ASSISTANT, TEACHER } = OrganizationMemberRoleEnum;

/**
 * Who may do what with the academic structure, from the request's tenant (OrganizationContextGuard).
 * A solo teacher is OWNER of their own workspace. Students never reach these routes.
 */
export const AcademicAccess = {
  /** Staff can read sessions, sections and subject classes. */
  read(): Tenant {
    return requireRole([OWNER, ADMIN, ASSISTANT, TEACHER], 'Only staff of this workspace can see its academic structure');
  },

  /** Sections, subject classes, their teachers and students: as classes today (Owner, Admin, Assistant). */
  manageStructure(): Tenant {
    return requireRole([OWNER, ADMIN, ASSISTANT], 'Only owners, admins and assistants can change classes and sections');
  },

  /** Sessions and terms (FND-01): owners and admins. */
  manageSessions(): Tenant {
    return requireRole([OWNER, ADMIN], 'Only owners and admins can manage sessions');
  },

  /** Reopening a closed session (FND-01): the Owner only. */
  reopenSession(): Tenant {
    return requireRole([OWNER], 'Only the owner can reopen a closed session');
  },
};

function requireRole(roles: OrganizationMemberRoleEnum[], message: string): Tenant {
  const tenant = TenantContext.current();
  if (!tenant) throw new ForbiddenException('Choose a workspace first');
  if (tenant.viaEnrolment || !roles.includes(tenant.memberRole)) throw new ForbiddenException(message);
  return tenant;
}
