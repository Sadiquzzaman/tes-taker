/** The IELTS workspace (P10, Epic 11). */
type IeltsModule = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
type IeltsTestType = "ACADEMIC" | "GENERAL";

/** `GET /ielts/profiles`, `/ielts/profiles/me`. */
interface IeltsProfile {
  student: { id: string; full_name: string; batch: string | null };
  test_type: IeltsTestType | null;
  target_overall: number | null;
  target_bands: Partial<Record<IeltsModule, number>>;
  test_date: string | null;
  /** Days until the booked test (negative once it has passed). */
  days_to_test: number | null;
  updated_at: string | null;
}

type IeltsTestPurpose = "MOCK" | "PRACTICE";
type IeltsTestStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** `GET /ielts/tests` */
interface IeltsTestSummary {
  id: string;
  title: string;
  test_type: IeltsTestType;
  purpose: IeltsTestPurpose;
  modules: IeltsModule[];
  durations: Partial<Record<IeltsModule, number>>;
  status: IeltsTestStatus;
  needs_review: boolean;
  created_by: { id: string; full_name: string };
  updated_at: string;
  /** Question numbers used per module (a mock's Listening and Reading need 40). */
  question_counts: Partial<Record<IeltsModule, number>>;
}

interface IeltsOption {
  key: string;
  text: string;
}

type IeltsAnswerKey = { accepted: string[] } | { keys: string[] };

interface IeltsQuestion {
  id: string;
  sort_order: number;
  number_from: number;
  number_to: number;
  prompt: string | null;
  options: IeltsOption[] | null;
  answer: IeltsAnswerKey;
}

interface IeltsGroup {
  id: string;
  type: string;
  instruction: string;
  word_limit: number | null;
  shared: { options?: IeltsOption[]; text?: string } | null;
  image_file_id: string | null;
  sort_order: number;
  number_from: number | null;
  number_to: number | null;
  questions: IeltsQuestion[];
}

interface IeltsPart {
  id: string;
  module: IeltsModule;
  part_no: number;
  title: string | null;
  content: string | null;
  audio_file_id: string | null;
  image_file_id: string | null;
  groups: IeltsGroup[];
}

/** `GET /ielts/tests/:id` (staff) */
interface IeltsTest extends Omit<IeltsTestSummary, "question_counts"> {
  can_edit: boolean;
  parts: IeltsPart[];
}

/** What stops a test being published (`details.problems` of IELTS_TEST_INCOMPLETE). */
interface IeltsTestProblem {
  module: IeltsModule;
  part_no: number | null;
  problem: "NO_RECORDING" | "NO_TEXT" | "NO_QUESTIONS" | "NO_PICTURE" | "NOT_40";
  count?: number;
}

/** `GET /ielts/band-tables` */
interface IeltsBandTable {
  module: "LISTENING" | "READING";
  test_type: IeltsTestType | null;
  rows: { min_raw: number; band: number }[];
  customised: boolean;
  updated_at: string | null;
}

type IeltsAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "MARKED";

/** `GET /ielts/my/assignments` */
interface IeltsMyAssignment {
  id: string;
  test: { id: string; title: string; purpose: IeltsTestPurpose; test_type: IeltsTestType; modules: IeltsModule[]; durations: Partial<Record<IeltsModule, number>> };
  opens_at: string;
  closes_at: string;
  is_open: boolean;
  attempts: Partial<Record<IeltsModule, { id: string; status: IeltsAttemptStatus; mode?: string | null; deadline: string; raw_score: number | null; raw_total?: number | null; band: number | null }>>;
}

/** A question as a student sees it; `key` and `marks` only after hand-in when answers may be shown. */
interface IeltsPaperQuestion {
  id: string;
  number_from: number;
  number_to: number;
  prompt: string | null;
  options: IeltsOption[] | null;
  key?: IeltsAnswerKey;
  marks?: number;
}

interface IeltsPaperGroup {
  id: string;
  type: string;
  instruction: string;
  word_limit: number | null;
  shared: { options?: IeltsOption[]; text?: string } | null;
  image_file_id: string | null;
  number_from: number | null;
  number_to: number | null;
  questions: IeltsPaperQuestion[];
}

interface IeltsPaperPart {
  id: string;
  module: IeltsModule;
  part_no: number;
  title: string | null;
  content: string | null;
  audio_file_id: string | null;
  image_file_id: string | null;
  groups: IeltsPaperGroup[];
}

/** `POST /ielts/my/assignments/:id/modules/:module/start`, `GET /ielts/my/attempts/:id` */
interface IeltsAttemptView {
  attempt: {
    id: string;
    assignment_id: string;
    module: IeltsModule;
    status: IeltsAttemptStatus;
    started_at: string;
    deadline: string;
    submitted_at: string | null;
    raw_score: number | null;
    /** What the score is out of (40 in a full test). */
    raw_total?: number | null;
    band: number | null;
    /** Writing, once marked: `{ tasks: [{ part_id, part_no, criteria, band, comment }] }`. */
    criteria?: Record<string, unknown> | null;
    feedback?: string | null;
    /** Speaking: LIVE (with the teacher) or RECORDED (practice). */
    mode?: string | null;
    /** Speaking: part id → recording file id. */
    recordings?: Record<string, string>;
    now: string;
    review_seconds: number;
  };
  test: { id: string; title: string; test_type: IeltsTestType; purpose: IeltsTestPurpose };
  parts: IeltsPaperPart[] | null;
  answers: Record<string, string>;
}

/** `GET /ielts/tests/:id/assignments` */
interface IeltsAssignment {
  id: string;
  test_id: string;
  section: { id: string; name: string };
  opens_at: string;
  closes_at: string;
  students: number;
  submitted: Partial<Record<IeltsModule, number>>;
}

/** `GET /ielts/assignments/:id/results` */
interface IeltsResultRow {
  student: { id: string; full_name: string };
  /** All four modules marked. */
  overall?: number | null;
  modules: Partial<Record<IeltsModule, { attempt_id: string; status: IeltsAttemptStatus; mode?: string | null; raw_score: number | null; raw_total?: number | null; band: number | null; submitted_at: string | null }>>;
}

/** `GET /ielts/marking` */
interface IeltsMarkingRow {
  attempt_id: string;
  module: IeltsModule;
  status: IeltsAttemptStatus;
  student: { id: string; full_name: string };
  test: { id: string; title: string };
  batch: string;
  submitted_at: string | null;
  band: number | null;
}

/** `GET /ielts/marking/:attemptId` */
interface IeltsMarkingView extends IeltsMarkingRow {
  test_type: IeltsTestType;
  /** Speaking: LIVE or RECORDED. */
  mode?: string | null;
  tasks: { part_id: string; part_no: number; title: string | null; content: string | null; image_file_id: string | null; script: string; words: number; min_words: number; recording_file_id?: string | null }[];
  marks: { part_id: string; part_no: number; criteria: Record<string, number>; band: number; comment: string | null }[];
  /** Speaking: FC, LR, GRA, P once marked. */
  speaking?: Record<string, number> | null;
  feedback: string | null;
  marked_by: string | null;
  marked_at: string | null;
}

interface IeltsBandPoint {
  attempt_id: string;
  assignment_id: string;
  test_title: string;
  purpose: IeltsTestPurpose;
  band: number;
  raw_score: number | null;
  raw_total?: number | null;
  at: string;
}

/** `GET /ielts/progress/:studentId`, `/ielts/progress/me` */
interface IeltsProgressView {
  profile: IeltsProfile;
  modules: Record<IeltsModule, IeltsBandPoint[]>;
  mocks: { assignment_id: string; test_title: string; bands: Record<IeltsModule, number>; overall: number; at: string }[];
  question_types: { type: string; right: number; total: number; percent: number }[];
}

/** `GET /ielts/dashboard` */
interface IeltsStaffDashboard {
  batches: number;
  students: number;
  upcoming: { assignment_id: string; test_title: string; batch: string; opens_at: string; closes_at: string }[];
  waiting: { writing: number; speaking: number };
  batch_bands: { section_id: string; batch: string; bands: Partial<Record<IeltsModule, number>> }[];
}

/** `GET /ielts/dashboard/me` */
interface IeltsStudentDashboard {
  profile: IeltsProfile;
  latest: Partial<Record<IeltsModule, number>>;
  next: { assignment_id: string; test_title: string; purpose: IeltsTestPurpose; opens_at: string; closes_at: string } | null;
  open_now: number;
}

/** `GET /ielts/report/:assignmentId/:studentId` */
interface IeltsBandReport {
  student: { id: string; full_name: string; batch: string | null };
  test: { id: string; title: string; test_type: IeltsTestType; purpose: IeltsTestPurpose };
  window: { opens_at: string; closes_at: string };
  modules: Partial<Record<IeltsModule, { band: number | null; raw_score: number | null; raw_total?: number | null; status: string; criteria: Record<string, unknown> | null; feedback: string | null }>>;
  overall: number | null;
  targets: { overall: number | null; bands: Partial<Record<IeltsModule, number>> };
  test_date: string | null;
}

/** An IELTS course (P12-04, IEL-13). */
type IeltsCourseStatus = "UPCOMING" | "RUNNING" | "ENDED";
interface IeltsCourse {
  id: string;
  title: string;
  branch: { id: string; name: string | null; is_default: boolean } | null;
  start_date: string;
  end_date: string;
  status: IeltsCourseStatus;
  modules: IeltsModule[];
  seat_limit: number | null;
  students: number;
  teachers: { module: IeltsModule; offering_id: string | null; teachers: { id: string; full_name: string | null }[] }[];
  class_id: string;
  session_id: string;
  section_id: string;
}
