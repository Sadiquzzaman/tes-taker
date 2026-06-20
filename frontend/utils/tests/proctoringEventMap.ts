const SOCKET_FLAG_TYPE_MAP: Record<ProctoringFlagType, string> = {
  "tab-switch": "TAB_SWITCH",
  "window-blur": "BROWSER_SWITCH",
  "fullscreen-exit": "FULLSCREEN_EXIT",
  "no-face": "NO_FACE",
  "multiple-faces": "MULTIPLE_FACES",
  "looking-away": "LOOKING_AWAY",
  "phone-detected": "PHONE_DETECTED",
  "paste-attempt": "PASTE",
  "restricted-action": "PAGE_REFRESH",
  "voice-detected": "VOICE_ACTIVITY",
  "idle-too-long": "IDLE",
  "devtools-open": "DEVTOOLS",
  "screen-sharing": "SCREEN_SHARING",
};

const PERSISTED_VIOLATION_TYPE_MAP: Partial<Record<ProctoringFlagType, "TAB_SWITCH" | "BROWSER_SWITCH">> = {
  "tab-switch": "TAB_SWITCH",
  "window-blur": "BROWSER_SWITCH",
};

export const getSocketFlagType = (flagType: ProctoringFlagType) => SOCKET_FLAG_TYPE_MAP[flagType];

export const getPersistedViolationType = (flagType: ProctoringFlagType) => PERSISTED_VIOLATION_TYPE_MAP[flagType];
