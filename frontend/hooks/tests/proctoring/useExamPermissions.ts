import { useCallback, useEffect, useRef, useState } from "react";
import { stopMediaTracks } from "./proctoringMonitorUtils";

export type ExamPermissionStatus = "pending" | "granted" | "denied" | "unsupported";

export type ExamPermissionState = {
  camera: ExamPermissionStatus;
  microphone: ExamPermissionStatus;
};

const INITIAL_PERMISSION_STATE: ExamPermissionState = {
  camera: "pending",
  microphone: "pending",
};

const getTrackState = (stream: MediaStream | null, kind: "video" | "audio"): ExamPermissionStatus => {
  if (!stream) {
    return "pending";
  }

  const track = stream.getTracks().find((item) => item.kind === kind);

  if (!track) {
    return "pending";
  }

  if (track.readyState === "live" && track.enabled) {
    return "granted";
  }

  if (track.readyState === "ended") {
    return "denied";
  }

  return "pending";
};

const useExamPermissions = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<ExamPermissionState>(INITIAL_PERMISSION_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const syncPermissionState = useCallback((nextCameraStream: MediaStream | null) => {
    setPermissionState({
      camera: getTrackState(nextCameraStream, "video"),
      microphone: getTrackState(nextCameraStream, "audio"),
    });
  }, []);

  const requestCameraAndMicrophone = useCallback(async () => {
    setErrorMessage(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState({
        camera: "unsupported",
        microphone: "unsupported",
      });
      setErrorMessage("This browser does not support camera and microphone access.");
      return;
    }

    try {
      stopMediaTracks(cameraStream);
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      setCameraStream(nextStream);
      syncPermissionState(nextStream);
    } catch {
      setPermissionState({
        camera: "denied",
        microphone: "denied",
      });
      setErrorMessage("Camera and microphone access was denied. Allow both in browser settings and try again.");
    }
  }, [cameraStream, syncPermissionState]);

  const allPermissionsGranted =
    permissionState.camera === "granted" && permissionState.microphone === "granted";

  useEffect(() => {
    pollIntervalRef.current = window.setInterval(() => {
      syncPermissionState(cameraStream);
    }, 1000);

    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, [cameraStream, syncPermissionState]);

  return {
    cameraStream,
    permissionState,
    errorMessage,
    allPermissionsGranted,
    requestCameraAndMicrophone,
  };
};

export default useExamPermissions;
