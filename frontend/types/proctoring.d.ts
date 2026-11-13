type ProctoringRiskLevel = "Normal" | "Suspicious" | "High Risk" | "Likely Cheating";
type ProctoringSetupStatus = "idle" | "starting" | "ready" | "error";

type ProctoringFlagType =
  | "tab-switch"
  | "window-blur"
  | "fullscreen-exit"
  | "no-face"
  | "multiple-faces"
  | "looking-away"
  | "phone-detected"
  | "paste-attempt"
  | "restricted-action"
  | "voice-detected"
  | "idle-too-long"
  | "devtools-open"
  | "screen-sharing"
  | "camera-blocked"
  | "screen-share-stopped"
  | "double-display";

type ProctoringCountdownType = "screen-share" | "double-display";

type ProctoringCountdownState = {
  type: ProctoringCountdownType;
  secondsRemaining: number;
  message: string;
};

type ProctoringWarningState = {
  /** The student sees the translated text for this type; `message` (English) is the detail for the log. */
  type: ProctoringFlagType;
  message: string;
  flagCount: number;
  /** Set when this flag reached the warning point: counted flags so far and the limit (PRO-02). */
  limit?: { count: number; threshold: number };
};

type ProctoringFlag = {
  id: string;
  type: ProctoringFlagType;
  message: string;
  points: number;
  timestamp: string;
};

type ProctoringSummary = {
  flags: ProctoringFlag[];
  totalPenaltyPoints: number;
  flagCount: number;
  riskLevel: ProctoringRiskLevel;
  isDisqualified: boolean;
};

interface ProctoringState extends ProctoringSummary {
  isProctoringActive: boolean;
  permissionError: string | null;
  setupStatus: ProctoringSetupStatus;
  pendingWarning: ProctoringWarningState | null;
  isWarningBlocking: boolean;
  activeCountdown: ProctoringCountdownState | null;
  disqualificationReason: string | null;
  enableAutoDisqualification: boolean;
  /** The exam's limit (P8-01): flags of the counted checks; warned at `warnAt`. */
  disqualifyThreshold: number;
  disqualifyWarnAt: number;
  /** Checks whose flags count; null = every flag. */
  countedChecks: string[] | null;
  countedFlags: number;
}

interface AddProctoringFlagPayload {
  type: ProctoringFlagType;
  message: string;
  points?: number;
}

interface VideoMonitoringOptions {
  isActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream: MediaStream | null;
  onMonitoringError?: (message: string) => void;
}

interface VoiceMonitoringOptions {
  isActive: boolean;
  mediaStream: MediaStream | null;
}

interface UseProctoringOptions {
  isExamReady: boolean;
  doubleDisplayTimeoutSeconds?: number;
  initialMediaStream?: MediaStream | null;
  skipAutoSetup?: boolean;
  proctoringFeatures?: Record<string, boolean>;
  /** The exam's limit for auto-disqualification (P8-01); null = never automatic. */
  autoDisqualify?: { threshold: number; warn_at: number; checks: string[] } | null;
  /** Whether this exam uses the camera and microphone (Strict); false = no media is requested. */
  needsCamera?: boolean;
}

interface UseProctoringResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mediaStream: MediaStream | null;
  retryProctoringSetup: () => void;
  stopProctoringSession: () => void;
}

interface ProctoringPanelProps {
  mediaStream: MediaStream | null;
  onRetry: () => void;
  connectionError?: string | null;
}

interface UseProctoringSocketOptions {
  answerSheet: AnswersheetMap;
  examId?: string;
  flags: ProctoringFlag[];
  isEnabled: boolean;
  totalFlagPoints: number;
  /** A warning the teacher sent from the live monitor (P8-03). */
  onTeacherWarning?: (warning: { message: string; from: string }) => void;
  /** The teacher ended this student's exam (P8-03). */
  onExamEnded?: (reason: string) => void;
}

interface UseProctoringSocketResult {
  connectToSocket: () => void;
  emitExamSubmit: () => void;
  isSessionReady: boolean;
  connectionError: string | null;
}

interface ScreenSharingMonitoringOptions {
  isActive: boolean;
  allowScreenShare?: boolean;
  screenShareDisqualifySeconds?: number;
}

interface StartStudentExamPayload {
  user_agent?: string;
}

interface StartStudentExamResponsePayload {
  id: string;
  status: string;
  started_at?: string | null;
}

interface FaceMeshPoint {
  x: number;
  y: number;
  z?: number;
}

interface FaceMeshResult {
  multiFaceLandmarks?: FaceMeshPoint[][];
}

interface Screen {
  isExtended?: boolean;
}

interface Window {
  getScreenDetails?: () => Promise<{ screens: readonly unknown[] }>;
  webkitAudioContext?: typeof AudioContext;
}

/** Proctoring level per exam (P8-01, PRO-01, PRO-02). */
type ProctoringLevel = "OFF" | "LIGHT" | "STRICT";

/** What a teacher chose; check keys are plan feature keys (e.g. proctoring_idle). */
interface ExamProctoringChoice {
  level: ProctoringLevel;
  checks_off: string[];
  auto_disqualify: boolean;
  disqualify_threshold: number;
  disqualify_checks: string[] | null;
  /** Alert the teacher when a student reaches this many flags (P8-03); null = no alerts. */
  alert_flags?: number | null;
}

/** `GET /exams/proctoring-options`: what the workspace's plan offers. */
interface ProctoringOptions {
  levels: { level: ProctoringLevel; available: boolean; checks: string[] }[];
  auto_disqualify_available: boolean;
  alerts_available?: boolean;
  default_level: ProctoringLevel;
}

/** What the student's browser runs (`proctoring` in the eligibility check). */
interface EffectiveProctoring {
  level: ProctoringLevel;
  checks: string[];
  camera: boolean;
  auto_disqualify: { threshold: number; warn_at: number; checks: string[] } | null;
}

/** A student on the live monitor (P8-03, PRO-03): `GET /exams/:id/proctoring/sessions` and socket events. */
type MonitorLiveStatus = "WRITING" | "SUBMITTED" | "ENDED" | "DISCONNECTED" | "LOST";

interface MonitorSession {
  studentId: string;
  studentName: string;
  liveStatus: MonitorLiveStatus;
  lastSeenAt?: string;
  lostSince?: string | null;
  flagCount: number;
  totalFlagPoints: number;
  latestFlag: { id: string; type: string; message: string; points: number; timestamp: string } | null;
  deadline?: string | null;
  attemptStatus?: string | null;
}

interface MonitorTimelineEvent {
  id: string;
  type: string;
  check: string | null;
  message: string | null;
  points: number;
  source: "LIVE" | "SUBMIT" | "SERVER";
  occurred_at: string;
}

/** The integrity report (P8-04, PRO-04): `GET /exams/:id/proctoring/integrity`. */
type AttemptReviewDecision = "REINSTATE" | "RETAKE" | "CONFIRM";

interface IntegrityStudentRow {
  student_id: string;
  student_name: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  flags: number;
  checks: { check: string; count: number }[];
  disqualification_reason: string | null;
  last_review: { decision: AttemptReviewDecision; reason: string; decided_at: string } | null;
}

interface IntegrityReport {
  exam_id: string;
  summary: { students: number; flagged: number; disqualified: number; reviewed: number };
  by_check: { check: string; count: number; students: number }[];
  students: IntegrityStudentRow[];
}

/** One student's report (PRO-04, PRO-05): `GET /exams/:id/proctoring/students/:studentId/report`. */
interface StudentIntegrityReport {
  attempt: { student_id: string; student_name: string; status: string; started_at: string | null; submitted_at: string | null; total_score: number | null; max_score: number | null; disqualification_reason: string | null };
  checks: { check: string; count: number }[];
  timeline: MonitorTimelineEvent[];
  reviews: { id: string; decision: AttemptReviewDecision; reason: string; previous_status: string; previous_score: number | null; decided_at: string; decided_by_name: string | null }[];
}
