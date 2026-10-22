type OrganizationStatus = "pending" | "approved" | "rejected" | "inactive";

type OrganizationMemberRole = "OWNER" | "ADMIN" | "ASSISTANT" | "TEACHER" | "STUDENT";

interface OrganizationSummary {
  id: string;
  name: string;
  public_id?: string | null;
  organization_number?: number;
  status: OrganizationStatus;
  role?: OrganizationMemberRole;
  rejected_reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
}

interface OrganizationWorkspaceItem extends OrganizationSummary {
  role: OrganizationMemberRole;
}

interface OrganizationMemberUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role?: string | null;
  teacher_public_id?: string | null;
  student_public_id?: string | null;
  public_id?: string | null;
  personal_teacher_enabled?: boolean;
}

interface OrganizationMemberItem {
  id: string;
  role: OrganizationMemberRole;
  created_at?: string;
  is_active?: number;
  removed_at?: string | null;
  user: OrganizationMemberUser;
}

interface OrganizationSubjectItem {
  id: string;
  name: string;
  code?: string | null;
  classes?: Array<{ id: string; class_name: string }>;
  teacher_id?: string | null;
  teacher_name?: string | null;
}

interface OrganizationDetail extends OrganizationSummary {
  members_count?: number;
  teachers_count?: number;
  students_count?: number;
  classes_count?: number;
  exams_count?: number;
}

interface OrganizationRegisterInfo {
  organization_name: string;
  full_name: string;
  phone: string;
  email: string;
  password: string;
  confirm_password: string;
  agreed: boolean;
}

interface AdminOrganizationItem {
  id: string;
  name: string;
  public_id?: string | null;
  organization_number?: number;
  status: OrganizationStatus;
  rejected_reason?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  owner?: OrganizationMemberUser | null;
}

interface AdminOrganizationsListResponse {
  message: string;
  payload: AdminOrganizationItem[];
  meta?: {
    total_pages?: number;
    total?: number;
  };
}

type WorkspaceSelection =
  | { type: "individual" | "personal_teacher" }
  | { type: "organization"; id: string; name?: string }
  | { type: "individual_teacher"; teacherId: string; name?: string };
