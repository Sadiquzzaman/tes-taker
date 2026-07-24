type TeacherRequestStatus = "pending" | "approved" | "rejected";

interface TeacherRequestSummary {
  id: string;
  status: TeacherRequestStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface AdminTeacherRequestUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
}

interface AdminTeacherRequestItem {
  id: string;
  status: TeacherRequestStatus;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  user: AdminTeacherRequestUser;
}

interface AdminTeacherRequestsListResponse {
  message: string;
  payload: AdminTeacherRequestItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
