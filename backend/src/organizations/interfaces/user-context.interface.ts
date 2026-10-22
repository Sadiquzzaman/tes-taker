import { OrganizationMemberRoleEnum } from '../enums/organization-member-role.enum';
import { OrganizationStatusEnum } from '../enums/organization-status.enum';

export type UserContextType =
  | 'personal_teacher'
  | 'organization'
  | 'individual_teacher';

export interface UserContextItem {
  type: UserContextType;
  /** Stable client key, e.g. personal_teacher | org:<uuid> | teacher:<uuid> */
  key: string;
  /** Primary display name: "My Teaching", org name, or "Rahim Ahmed's Classes" */
  label: string;
  /** Secondary role label: Teacher, Student, Owner / Teacher, etc. */
  role_label: string;
  /** Organization UUID when type === organization */
  organization_id?: string;
  organization_public_id?: string | null;
  organization_number?: number | null;
  member_role?: OrganizationMemberRoleEnum | 'TEACHER' | 'STUDENT';
  organization_status?: OrganizationStatusEnum;
  /** Teacher user UUID when type === individual_teacher (student under personal teacher) */
  teacher_id?: string;
  /** When false, UI may show pending/restricted state */
  actionable: boolean;
}
