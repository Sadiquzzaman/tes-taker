import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import isVideoFrameReady from "./isVideoFrameReady";
import { createFlagReporter, DEFAULT_FLAG_COOLDOWN_MS } from "./proctoringMonitorUtils";

const CHECK_INTERVAL_MS = 1000;
const LOOKING_AWAY_DELAY_MS = 3000;
const LEFT_EYE_INDEX = 33;
const RIGHT_EYE_INDEX = 263;
const NOSE_INDEX = 1;

const GPU_ERROR_MESSAGE =
  "Face monitoring could not start because browser GPU/WebGL access is disabled. Please enable hardware acceleration/GPU access in Chrome and reload the page.";
const WEBGL_ALERT_TEXT = "Failed to create WebGL canvas context when passing video frame.";

const getMonitoringErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (/webgl|canvas context|gpu/i.test(message)) {
    return GPU_ERROR_MESSAGE;
  }

  return "Face monitoring failed. Please refresh the page and check camera/browser permissions.";
};

const isWebGLAvailable = () => {
  try {
    const canvas = document.createElement("canvas");

    const webglContext =
      canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    return Boolean(webglContext);
  } catch {
    return false;
  }
};

const useHeadEyeMonitoring = ({ isActive, videoRef, mediaStream, onMonitoringError }: VideoMonitoringOptions) => {
  const dispatch = useAppDispatch();

  const lookingAwayStartedAtRef = useRef<number | null>(null);
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});
  const hasReportedMonitoringErrorRef = useRef(false);

  useEffect(() => {
    const canMonitor = isActive && Boolean(mediaStream);
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, DEFAULT_FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    if (canMonitor && mediaStream) {
      hasReportedMonitoringErrorRef.current = false;

      let isStopped = false;
      let intervalId: number | null = null;
      let closeFaceMesh: (() => void) | null = null;
      let isProcessingFrame = false;

      const stopMonitoring = () => {
        isStopped = true;

        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }

        closeFaceMesh?.();
        closeFaceMesh = null;
      };

      const handleMonitoringError = (error: unknown) => {
        if (hasReportedMonitoringErrorRef.current) {
          return;
        }

        hasReportedMonitoringErrorRef.current = true;

        const message = getMonitoringErrorMessage(error);
        onMonitoringError?.(message);
      };

      const originalAlert = window.alert;

      window.alert = (message?: unknown) => {
        const text = String(message ?? "");

        if (text.includes(WEBGL_ALERT_TEXT)) {
          handleMonitoringError(new Error(text));
          stopMonitoring();
          return;
        }

        originalAlert(text);
      };

      const isLookingAway = (landmarks: FaceMeshPoint[]) => {
        const leftEye = landmarks[LEFT_EYE_INDEX];
        const rightEye = landmarks[RIGHT_EYE_INDEX];
        const nose = landmarks[NOSE_INDEX];

        if (!leftEye || !rightEye || !nose) {
          return false;
        }

        const eyeDistance = rightEye.x - leftEye.x;

        if (eyeDistance <= 0) {
          return false;
        }

        const noseRatio = (nose.x - leftEye.x) / eyeDistance;

        return noseRatio < 0.35 || noseRatio > 0.65;
      };

      const handleResults = (results: FaceMeshResult) => {
        const faceCount = results.multiFaceLandmarks?.length ?? 0;

        if (faceCount === 0) {
          lookingAwayStartedAtRef.current = null;
          reportFlag("no-face", "No face was detected in the webcam frame.");
          return;
        }

        if (faceCount > 1) {
          reportFlag("multiple-faces", "Multiple faces were detected in the webcam frame.");
        }

        const landmarks = results.multiFaceLandmarks?.[0];

        if (!landmarks || !isLookingAway(landmarks)) {
          lookingAwayStartedAtRef.current = null;
          return;
        }

        const now = Date.now();

        if (!lookingAwayStartedAtRef.current) {
          lookingAwayStartedAtRef.current = now;
          return;
        }

        const hasLookedAwayLongEnough = now - lookingAwayStartedAtRef.current >= LOOKING_AWAY_DELAY_MS;

        if (hasLookedAwayLongEnough) {
          const didFlag = reportFlag("looking-away", "Student appeared to look away from the screen.");

          if (didFlag) {
            lookingAwayStartedAtRef.current = null;
          }
        }
      };

      const startMonitoring = async () => {
        if (!isWebGLAvailable()) {
          handleMonitoringError(new Error(GPU_ERROR_MESSAGE));
          stopMonitoring();
          return;
        }

        const { FaceMesh } = await import("@mediapipe/face_mesh");

        const faceMesh = new FaceMesh({
          locateFile: (fileName: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${fileName}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 2,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults(handleResults);

        closeFaceMesh = () => {
          void faceMesh.close();
        };

        if (isStopped) {
          closeFaceMesh();
          return;
        }

        const processFrame = async () => {
          const video = videoRef.current;

          if (!isVideoFrameReady(video) || isProcessingFrame || isStopped) {
            return;
          }

          isProcessingFrame = true;

          try {
            await faceMesh.send({ image: video });
          } catch (error) {
            handleMonitoringError(error);
            stopMonitoring();
          } finally {
            isProcessingFrame = false;
          }
        };

        intervalId = window.setInterval(() => {
          void processFrame();
        }, CHECK_INTERVAL_MS);
      };

      void startMonitoring().catch((error) => {
        handleMonitoringError(error);
        stopMonitoring();
      });

      cleanup = () => {
        window.alert = originalAlert;
        stopMonitoring();
      };
    }

    return cleanup;
  }, [dispatch, isActive, mediaStream, onMonitoringError, videoRef]);
};

export default useHeadEyeMonitoring;
