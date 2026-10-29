/** Academic structure from the API (P2-03): sessions, terms, sections, subject classes, enrolments. */

type AcademicSessionStatus = "ACTIVE" | "CLOSED";

interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AcademicSessionStatus;
  is_default: boolean;
}

interface AcademicTerm {
  id: string;
  session_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
}

type SectionShift = "MORNING" | "DAY" | "EVENING";

interface AcademicPerson {
  id: string;
  full_name: string;
}

interface ClassSection {
  id: string;
  class_id: string;
  session_id: string;
  name: string;
  shift: SectionShift | null;
  room: string | null;
  class_teacher: AcademicPerson | null;
  student_count: number;
}

type OfferingEnrolmentMode = "WHOLE_SECTION" | "SELECTED";

interface SubjectClass {
  id: string;
  section_id: string;
  session_id: string;
  term_id: string | null;
  subject: { id: string; name: string; code: string | null };
  enrolment_mode: OfferingEnrolmentMode;
  is_optional: boolean;
  teachers: AcademicPerson[];
}

type EnrolmentStatus = "INVITED" | "PENDING" | "ACTIVE" | "LEFT" | "PROMOTED";

interface SectionEnrolment {
  id: string;
  student: (AcademicPerson & { email: string | null; phone: string | null }) | null;
  roll_no: string | null;
  status: EnrolmentStatus;
  invited_phone: string | null;
  invited_email: string | null;
  joined_at: string | null;
}

interface RosterStudent {
  enrolment_id: string;
  student_id: string;
  full_name: string;
  roll_no: string | null;
}

interface OrganizationSettings {
  organization_id: string;
  class_teacher_enabled: boolean;
}
