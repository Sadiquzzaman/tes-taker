export interface JwtPayloadInterface {
  id: string;
  email: string;
  is_verified?: number;
  full_name: string;
  role: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  /** Present only for organization login sessions */
  organization_id?: string;
  organization_number?: number;
  member_role?: string;
  session_mode?: 'individual' | 'organization';
  context_type?: 'personal_teacher' | 'organization' | 'individual_teacher' | 'individual';
  personal_teacher_enabled?: boolean;
  /** Personal teacher UUID when viewing as student under an individual teacher */
  teacher_id?: string;
}
