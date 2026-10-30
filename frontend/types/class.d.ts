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
  student_public_id?: string | null;
  is_otp_verified: boolean;
  is_verified: boolean;
  role: string;
  refresh_token: string;
}

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  subject?: {
    id: string;
    name: string;
    code?: string | null;
  };
}

interface AssignedClassSubject {
  class_subject_id: string;
  subject_id: string;
  name: string;
  code: string | null;
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
  organization_id?: string | null;
  /** ORGANIZATION classes follow school rules; PERSONAL ones are a solo teacher's (in their SOLO organisation). */
  class_kind?: "ORGANIZATION" | "PERSONAL";
  share_token: string | null;
  classStudents: ClassStudent[];
  classSubjects?: ClassSubject[];
  total_test_taken: number;
  last_test_taken_date: string | null;
  type?: "new" | "existing";
}

interface StudentClass {
  id: string;
  class_name: string;
  description: string;
  created_user_name: string;
  joined_at: string;
  organization_id?: string | null;
  organization_name?: string | null;
  teacher_id?: string | null;
  context_label?: string;
  total_test_taken?: number;
  last_test_taken_date?: string | null;
}

interface StudentClassDetailsResponse extends StudentClass {
  classmates: StudentClassmate[];
}

interface StudentClassmate {
  name: string;
  joined_at: string;
}

type ClassDetailsStudentItem = ClassStudent | StudentClassmate;

interface ClassDetailsData {
  id: string;
  class_name: string;
  description: string;
  created_user_name: string;
  organization_id?: string | null;
  class_kind?: "ORGANIZATION" | "PERSONAL";
  classStudents: ClassDetailsStudentItem[];
  classSubjects?: ClassSubject[];
  joined_at?: string;
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
  /** The student's section (P2-03); null for rows from before sections. */
  section?: { id: string; name: string } | null;
  roll_no?: string | null;
}

interface DeleteClassStudentPayload {
  student_ids: string[];
}

interface AddStudentInClassPayload {
  students: string[];
}

interface ClassCardProps<T> {
  classItem: T;
  index: number;
}

interface ClassListProps {
  role: RoleUserType | undefined;
}

interface ClassSliceState {
  activeTab: Tab;
  searchInput: string;
  newClassCreated: CreateClassResponse | null;
  openAddStudentModal: Class | null;
  openShareClassModal: Class | null;
}
