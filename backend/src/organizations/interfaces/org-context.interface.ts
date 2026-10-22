import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';

export interface OrgContext {
  organizationId: string;
  memberRole: OrganizationMemberRoleEnum;
}
