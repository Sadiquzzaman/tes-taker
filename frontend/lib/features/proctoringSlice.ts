import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import {
  getProctoringFlagCount,
  getProctoringRiskLevel,
  PROCTORING_FLAG_POINTS,
} from "@/utils/tests/proctoring";
import type { RootState } from "@/lib/store";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState: ProctoringState = {
  flags: [],
  totalPenaltyPoints: 0,
  flagCount: 0,
  riskLevel: "Normal",
  isProctoringActive: false,
  isDisqualified: false,
  permissionError: null,
  setupStatus: "idle",
  pendingWarning: null,
  isWarningBlocking: false,
  activeCountdown: null,
  disqualificationReason: null,
};

const createFlagId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const syncDerivedState = (state: ProctoringState) => {
  const flagCount = getProctoringFlagCount(state.flags);
  state.flagCount = flagCount;
  state.riskLevel = getProctoringRiskLevel(flagCount);
};

const addPenaltyFlag = (state: ProctoringState, payload: AddProctoringFlagPayload) => {
  if (!state.isProctoringActive || state.isDisqualified) {
    return;
  }

  const points = payload.points ?? PROCTORING_FLAG_POINTS[payload.type];

  state.flags.push({
    id: createFlagId(),
    type: payload.type,
    message: payload.message,
    points,
    timestamp: new Date().toISOString(),
  });
  state.totalPenaltyPoints += points;
  syncDerivedState(state);

  if (PROCTORING_CONFIG.enableFlagging) {
    state.pendingWarning = {
      message: payload.message,
      flagCount: state.flags.length,
    };
    state.isWarningBlocking = true;
  }

  if (state.flags.length >= PROCTORING_CONFIG.disqualifyAfter) {
    state.isDisqualified = true;
    state.disqualificationReason = "Maximum allowed violations exceeded.";
    state.isWarningBlocking = false;
    state.pendingWarning = null;
  }
};

export const proctoringSlice = createSlice({
  name: "proctoringSlice",
  initialState,
  reducers: {
    startProctoring: (state) => {
      state.isProctoringActive = true;
    },
    stopProctoring: (state) => {
      state.isProctoringActive = false;
      state.permissionError = null;
      state.setupStatus = "idle";
    },
    setProctoringSetupStarting: (state) => {
      state.permissionError = null;
      state.setupStatus = "starting";
    },
    setProctoringReady: (state) => {
      state.permissionError = null;
      state.setupStatus = "ready";
    },
    setProctoringPermissionError: (state, action: PayloadAction<string>) => {
      state.permissionError = action.payload;
      state.setupStatus = "error";
    },
    addFlag: (state, action: PayloadAction<AddProctoringFlagPayload>) => {
      addPenaltyFlag(state, action.payload);
    },
    dismissProctoringWarning: (state) => {
      state.pendingWarning = null;
      state.isWarningBlocking = false;
    },
    setProctoringCountdown: (state, action: PayloadAction<ProctoringCountdownState | null>) => {
      state.activeCountdown = action.payload;
    },
    resetProctoring: () => ({ ...initialState, flags: [] }),
    disqualifyExam: (state, action: PayloadAction<AddProctoringFlagPayload | undefined>) => {
      if (action.payload) {
        addPenaltyFlag(state, action.payload);
      }

      state.isDisqualified = true;
      state.disqualificationReason = action.payload?.message ?? "Exam session disqualified.";
      state.isWarningBlocking = false;
      state.pendingWarning = null;
      state.activeCountdown = null;
      syncDerivedState(state);
    },
  },
});

export const {
  startProctoring,
  stopProctoring,
  setProctoringSetupStarting,
  setProctoringReady,
  setProctoringPermissionError,
  addFlag,
  dismissProctoringWarning,
  setProctoringCountdown,
  resetProctoring,
  disqualifyExam,
} = proctoringSlice.actions;

export const selectProctoringState = (state: RootState) => state.proctoring;

export const selectIsProctoringReady = createSelector(
  [selectProctoringState],
  (proctoringState) => proctoringState.setupStatus === "ready",
);

export const selectIsProctoringActive = createSelector(
  [selectProctoringState],
  (proctoringState) => proctoringState.isProctoringActive,
);

export const selectProctoringFlagCount = createSelector([selectProctoringState], (proctoringState) =>
  getProctoringFlagCount(proctoringState.flags),
);

export const selectIsExamInteractionBlocked = createSelector(
  [selectProctoringState],
  (proctoringState) =>
    proctoringState.isDisqualified || proctoringState.isWarningBlocking || Boolean(proctoringState.activeCountdown),
);

export const selectProctoringStatusText = (state: RootState) => {
  if (state.proctoring.isDisqualified) {
    return "Disqualified";
  }

  if (selectIsProctoringReady(state) && state.proctoring.isProctoringActive) {
    return "Active";
  }

  if (state.proctoring.setupStatus === "starting") {
    return "Starting";
  }

  return "Required";
};

export const selectProctoringPanelState = createSelector(
  [selectProctoringState, selectProctoringStatusText, selectProctoringFlagCount],
  (proctoringState, statusText, flagCount) => ({
    flags: proctoringState.flags,
    totalPenaltyPoints: proctoringState.totalPenaltyPoints,
    flagCount,
    riskLevel: proctoringState.riskLevel,
    permissionError: proctoringState.permissionError,
    statusText,
    isDisqualified: proctoringState.isDisqualified,
    activeCountdown: proctoringState.activeCountdown,
  }),
);

export default proctoringSlice.reducer;
