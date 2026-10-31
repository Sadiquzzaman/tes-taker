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
  /** Name given for an invited student (CSV import). */
  invited_name: string | null;
  joined_at: string | null;
}

interface RosterStudent {
  enrolment_id: string;
  student_id: string;
  full_name: string;
  roll_no: string | null;
}

type OrganizationLocale = "bn" | "en";

interface OrganizationSettings {
  organization_id: string;
  class_teacher_enabled: boolean;
  /** Language for members who have not chosen one (organizations.default_locale). */
  default_locale: OrganizationLocale;
  /** When the academic setup wizard was finished (P2-04); null = not yet. */
  setup_completed_at: string | null;
  /** Guardian SMS language (FND-10): the organisation's choice, else its default language. */
  sms_locale: OrganizationLocale;
}

type GuardianRelation = "FATHER" | "MOTHER" | "OTHER";

/** A student's guardian (FND-09). */
interface Guardian {
  id: string;
  name: string;
  relation: GuardianRelation;
  phone: string;
  is_primary: boolean;
}

/** GET/PUT /enrolments/:id/guardians. */
interface StudentGuardians {
  guardians: Guardian[];
  /** The student's own SMS language; null = the organisation's. */
  sms_locale: OrganizationLocale | null;
  organization_sms_locale: OrganizationLocale;
}

/** GET /setup: progress of the academic setup wizard (P2-04, FND-02). */
interface AcademicSetupSummary {
  setup_completed_at: string | null;
  session: { id: string; name: string; start_date: string; end_date: string };
  classes: Array<{ id: string; name: string; subject_count: number; section_count: number }>;
}

/** POST /sections/:id/promotions (FND-05). */
interface PromotionResult {
  promoted: Array<{ student_id: string; full_name: string | null }>;
  skipped: Array<{ student_id: string; full_name: string | null; reason: "ALREADY_ENROLLED" }>;
}

type ImportErrorCode =
  | "NAME_REQUIRED"
  | "NAME_TOO_LONG"
  | "CONTACT_REQUIRED"
  | "INVALID_PHONE"
  | "INVALID_EMAIL"
  | "SECTION_REQUIRED"
  | "SECTION_NOT_FOUND"
  | "ROLL_TOO_LONG"
  | "ROLL_TAKEN"
  | "DUPLICATE_IN_FILE"
  | "ALREADY_IN_CLASS"
  | "ALREADY_INVITED"
  | "STAFF_ACCOUNT"
  | "GUARDIAN_INCOMPLETE"
  | "GUARDIAN_RELATION"
  | "GUARDIAN_PHONE"
  | "GUARDIAN_SAME_PHONE"
  | "SAVE_FAILED";

/** One row of a student CSV import (FND-04), from the preview or the import. */
interface ImportRowResult {
  row: number;
  name: string;
  contact: string;
  section: string;
  roll_no: string | null;
  guardians: number;
  plan: "ENROL" | "PENDING" | "INVITE" | null;
  outcome?: "ENROLLED" | "PENDING" | "INVITED" | "SKIPPED";
  errors: Array<{ code: ImportErrorCode; guardian?: 1 | 2 }>;
  warnings: Array<{ code: "GUARDIANS_KEPT"; guardian?: 1 | 2 }>;
}

interface ImportSummary {
  session: { id: string; name: string };
  rows: ImportRowResult[];
  total: number;
  valid: number;
  invalid: number;
  /** max 0 = unlimited. */
  limit: { max: number; current: number; adding: number; over: boolean };
  invitations_sent?: number;
}
