import { addFlag } from "@/lib/features/proctoringSlice";
import type { AppDispatch } from "@/lib/store";
import type { MutableRefObject } from "react";

export const DEFAULT_FLAG_COOLDOWN_MS = 15000;
export const PROCTORING_PERMISSION_REQUIRED_MESSAGE = "Webcam and microphone access are required to start the test.";
export const PROCTORING_PERMISSION_BLOCKED_MESSAGE =
  "Camera and microphone are blocked. Allow both in your browser site settings, then try again.";
export const PROCTORING_UNSUPPORTED_MEDIA_MESSAGE = "This browser does not support webcam and microphone access.";
export const PROCTORING_FULLSCREEN_REQUIRED_MESSAGE =
  "Fullscreen is required before webcam and microphone checks can start. Click Retry or Fullscreen and try again.";

type FlagCooldownMap = Partial<Record<ProctoringFlagType, number>>;

export const stopMediaTracks = (mediaStream: MediaStream | null) => {
  mediaStream?.getTracks().forEach((track) => track.stop());
};

export const createFlagReporter = (
  dispatch: AppDispatch,
  lastFlaggedAtRef: MutableRefObject<FlagCooldownMap>,
  cooldownMs: number = DEFAULT_FLAG_COOLDOWN_MS,
) => {
  return (type: ProctoringFlagType, message: string) => {
    const now = Date.now();
    const lastFlaggedAt = lastFlaggedAtRef.current[type] ?? 0;

    if (now - lastFlaggedAt < cooldownMs) {
      return false;
    }

    lastFlaggedAtRef.current[type] = now;
    dispatch(addFlag({ type, message }));
    return true;
  };
};

export const getPermissionErrorMessage = async () => {
  if (!navigator.permissions?.query) {
    return PROCTORING_PERMISSION_REQUIRED_MESSAGE;
  }

  try {
    const [cameraPermission, microphonePermission] = await Promise.all([
      navigator.permissions.query({ name: "camera" as PermissionName }),
      navigator.permissions.query({ name: "microphone" as PermissionName }),
    ]);

    if (cameraPermission.state === "denied" || microphonePermission.state === "denied") {
      return PROCTORING_PERMISSION_BLOCKED_MESSAGE;
    }
  } catch {
    return PROCTORING_PERMISSION_REQUIRED_MESSAGE;
  }

  return PROCTORING_PERMISSION_REQUIRED_MESSAGE;
};

export const requestFullscreenIfNeeded = async () => {
  if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
    return true;
  }

  try {
    await document.documentElement.requestFullscreen();
  } catch {
    return false;
  }

  return Boolean(document.fullscreenElement);
};

export const exitFullscreenIfActive = async () => {
  if (!document.fullscreenElement) {
    return;
  }

  try {
    await document.exitFullscreen();
  } catch {
    // Browser may block programmatic exit in some cases.
  }
};
