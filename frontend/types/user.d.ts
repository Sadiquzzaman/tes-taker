type SessionMode = "individual" | "organization";
type ContextType = "personal_teacher" | "organization" | "individual_teacher" | "individual";

interface LoginOrganizationSession {
  id: string;
  name: string;
  organization_number: number;
  role: OrganizationMemberRole;
  status: OrganizationStatus;
  public_id?: string | null;
}

interface UserContextItem {
  type: "personal_teacher" | "organization" | "individual_teacher";
  key: string;
  label: string;
  role_label: string;
  organization_id?: string;
  organization_public_id?: string | null;
  organization_number?: number | null;
  member_role?: OrganizationMemberRole | "TEACHER" | "STUDENT";
  organization_status?: OrganizationStatus;
  teacher_id?: string;
  actionable: boolean;
}

interface User {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string;
  updated_user_name: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  phone: string;
  is_verified: boolean;
  role: UserRoleEnum | RoleUserType;
  refresh_token: string;
  access_token: string;
  session_mode?: SessionMode;
  context_type?: ContextType;
  teacher_id?: string | null;
  personal_teacher_enabled?: boolean;
  public_id?: string | null;
  teacher_public_id?: string | null;
  student_public_id?: string | null;
  organization?: LoginOrganizationSession | null;
  contexts?: UserContextItem[];
  requires_context_selection?: boolean;
}

interface AdminUserListItem {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: RoleUserType;
  is_active: number;
  is_verified: boolean;
  is_otp_verified: boolean;
  created_at: string;
}

interface AdminUsersListResponse extends ApiResponse<AdminUserListItem[]> {
  meta: GradingPaginationMeta;
}
