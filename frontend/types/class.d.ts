type ClassTab = Tab[];

interface CreateClassPayload {
  class_name: string;
  description: string;
  student_ids: string[];
}
type CreateClassResponse = Class & {
  teacher: Teacher;
};

interface Teacher {
  id: string;
  is_active: number;
  created_by: any;
  created_user_name: any;
  updated_by: any;
  updated_user_name: any;
  created_at: string;
  updated_at: any;
  full_name: string;
  email: any;
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
  updated_by: any;
  updated_user_name: any;
  created_at: string;
  updated_at: any;
  class_name: string;
  description: string;
  teacher_id: string;
  students: any[];
}
