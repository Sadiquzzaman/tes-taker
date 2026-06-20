import { PROCTORING_FLAG_POINTS, getProctoringRiskLevel } from "@/utils/tests/proctoring";
import type { RootState } from "@/lib/store";
import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState: ProctoringState = {
  flags: [],
  totalPenaltyPoints: 0,
  riskLevel: "Normal",
  isProctoringActive: false,
  isDisqualified: false,
  permissionError: null,
  setupStatus: "idle",
};

const createFlagId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const addPenaltyFlag = (state: ProctoringState, payload: AddProctoringFlagPayload) => {
  if (!state.isProctoringActive) {
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
  state.riskLevel = getProctoringRiskLevel(state.totalPenaltyPoints);
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
    resetProctoring: () => ({ ...initialState, flags: [] }),
    disqualifyExam: (state, action: PayloadAction<AddProctoringFlagPayload | undefined>) => {
      if (action.payload) {
        addPenaltyFlag(state, action.payload);
      }

      if (state.totalPenaltyPoints < 10) {
        state.totalPenaltyPoints = 10;
      }

      state.isDisqualified = true;
      state.riskLevel = getProctoringRiskLevel(state.totalPenaltyPoints);
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
  [selectProctoringState, selectProctoringStatusText],
  (proctoringState, statusText) => ({
    totalPenaltyPoints: proctoringState.totalPenaltyPoints,
    riskLevel: proctoringState.riskLevel,
    permissionError: proctoringState.permissionError,
    statusText,
  }),
);

export default proctoringSlice.reducer;
