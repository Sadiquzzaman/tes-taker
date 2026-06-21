import { exitFullscreenIfActive } from "@/hooks/tests/proctoring/proctoringMonitorUtils";

let cameraStream: MediaStream | null = null;
let screenStream: MediaStream | null = null;

export const setExamMediaStreams = (camera: MediaStream | null, screen: MediaStream | null) => {
  cameraStream = camera;
  screenStream = screen;
};

export const getExamMediaStreams = () => ({
  cameraStream,
  screenStream,
});

export const clearExamMediaStreams = () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  screenStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  screenStream = null;
};

export const EXAM_PERMISSIONS_SESSION_KEY = "examPermissionsComplete";

export const markExamPermissionsComplete = () => {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(EXAM_PERMISSIONS_SESSION_KEY, "true");
  }
};

export const isExamPermissionsComplete = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(EXAM_PERMISSIONS_SESSION_KEY) === "true";
};

export const clearExamPermissionsComplete = () => {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(EXAM_PERMISSIONS_SESSION_KEY);
  }
};

export const clearExamSession = async () => {
  await exitFullscreenIfActive();
  clearExamMediaStreams();
  clearExamPermissionsComplete();
};
