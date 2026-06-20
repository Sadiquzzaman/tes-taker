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
  | "screen-sharing";

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
  riskLevel: ProctoringRiskLevel;
  isDisqualified: boolean;
};

interface ProctoringState extends ProctoringSummary {
  isProctoringActive: boolean;
  permissionError: string | null;
  setupStatus: ProctoringSetupStatus;
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
  allowScreenShare?: boolean;
  screenShareDisqualifySeconds?: number;
}

interface UseProctoringResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  retryProctoringSetup: () => void;
  stopProctoringSession: () => void;
}

interface UseProctoringSocketOptions {
  answerSheet: AnswersheetMap;
  examId?: string;
  flags: ProctoringFlag[];
  isEnabled: boolean;
  totalFlagPoints: number;
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

interface ProctoringPanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRetry: () => void;
  connectionError?: string | null;
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
