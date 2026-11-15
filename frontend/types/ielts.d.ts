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
  attempts: Partial<Record<IeltsModule, { id: string; status: IeltsAttemptStatus; deadline: string; raw_score: number | null; band: number | null }>>;
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
    band: number | null;
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
  modules: Partial<Record<IeltsModule, { status: IeltsAttemptStatus; raw_score: number | null; band: number | null; submitted_at: string | null }>>;
}
