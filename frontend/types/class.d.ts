type ClassTab = Tab[];

interface CreateClassPayload {
  class_name: string;
  description: string;
  student_ids: string[];
}

type CreateClassResponse = Class & {
  teacher: Teacher;
};

type Teacher = User;
type Student = User;
interface User {
  id: string;
  is_active: number;
  created_by: string | null;
  created_user_name: string | null;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  full_name: string;
  email: string | null;
  password: string;
  phone: string;
  is_otp_verified: boolean;
  is_verified: boolean;
  role: string;
  refresh_token: string;
}

interface Class {
  id: string;
  is_active: number;
  created_by: string;
  created_user_name: string;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  class_name: string;
  description: string;
  teacher_id: string;
  share_token: string | null;
  classStudents: ClassStudent[];
  total_test_taken: number;
  last_test_taken_date: string | null;
  type?: "new" | "existing";
}

interface ClassStudent {
  id: string;
  is_active: number;
  created_by: string | null;
  created_user_name: string | null;
  updated_by: string | null;
  updated_user_name: string | null;
  created_at: string;
  updated_at: string | null;
  class_id: string;
  student_id: string;
  student: Student;
  status: string;
  invited_email: string | null;
  invited_phone: string | null;
  invitation_token: string | null;
  invited_at: string | null;
  joined_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

interface DeleteClassStudentPayload {
  student_ids: string[];
}
