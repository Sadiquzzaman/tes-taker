import { ClassKindEnum } from 'src/classes/enums/class-kind.enum';
import { OrganizationKindEnum } from './enums/organization-kind.enum';
import { OrganizationMemberRoleEnum } from './enums/organization-member-role.enum';

/**
 * Whether a class follows organisation rules (members, assigned teachers, the org subject catalog).
 * Since P2-01 every class has an organisation, but a solo teacher's class (kind PERSONAL, in their
 * SOLO organisation) keeps personal rules: the teacher owns it and students join by enrolment only.
 */
export const usesOrganizationRules = <T extends { organization_id: string | null; class_kind?: ClassKindEnum | null }>(
  classEntity: T,
): classEntity is T & { organization_id: string } =>
  Boolean(classEntity.organization_id) && classEntity.class_kind === ClassKindEnum.ORGANIZATION;

/**
 * SQL for "the SOLO organisation of teacher :param" (one row or none), for scoping a student who
 * chose a solo teacher's classes: `exam.organization_id = (${soloOrganizationOf('teacherId')})`.
 */
export const soloOrganizationOf = (param: string) => `
  SELECT solo_member.organization_id
  FROM organization_members solo_member
  JOIN organizations solo_org ON solo_org.id = solo_member.organization_id
  WHERE solo_member.user_id = :${param}
    AND solo_member.role = '${OrganizationMemberRoleEnum.OWNER}'
    AND solo_org.kind = '${OrganizationKindEnum.SOLO}'
  LIMIT 1
`;
