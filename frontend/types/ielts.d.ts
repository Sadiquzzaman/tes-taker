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
