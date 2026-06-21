import {
  selectIsProctoringActive,
  resetProctoring,
  setProctoringPermissionError,
  setProctoringReady,
  setProctoringSetupStarting,
  startProctoring,
  stopProctoring,
} from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useToast } from "@/component/Toast/ToastContext";
import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import { useCallback, useEffect, useRef, useState } from "react";
import useBrowserMonitoring from "./useBrowserMonitoring";
import useDevToolsDetection from "./useDevToolsDetection";
import useDoubleDisplayMonitoring from "./useDoubleDisplayMonitoring";
import useHeadEyeMonitoring from "./useHeadEyeMonitoring";
import useIdleDetection from "./useIdleDetection";
import useKeyboardMonitoring from "./useKeyboardMonitoring";
import useObjectDetection from "./useObjectDetection";
import {
  getPermissionErrorMessage,
  PROCTORING_FULLSCREEN_REQUIRED_MESSAGE,
  PROCTORING_UNSUPPORTED_MEDIA_MESSAGE,
  requestFullscreenIfNeeded,
  stopMediaTracks,
} from "./proctoringMonitorUtils";
import useVoiceDetection from "./useVoiceDetection";

const useProctoring = ({
  isExamReady,
  doubleDisplayTimeoutSeconds = PROCTORING_CONFIG.doubleDisplayTimeout,
  initialMediaStream = null,
  skipAutoSetup = false,
}: UseProctoringOptions): UseProctoringResult => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const isProctoringActive = useAppSelector(selectIsProctoringActive);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(initialMediaStream);
  const activeSetupRequestRef = useRef(0);

  const stopProctoringSession = useCallback(() => {
    if (!skipAutoSetup) {
      setMediaStream((currentStream) => {
        stopMediaTracks(currentStream);
        return null;
      });
    }

    dispatch(stopProctoring());
  }, [dispatch, skipAutoSetup]);

  const requestMediaAccess = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      dispatch(setProctoringPermissionError(PROCTORING_UNSUPPORTED_MEDIA_MESSAGE));
      return;
    }

    const setupRequestId = activeSetupRequestRef.current + 1;
    activeSetupRequestRef.current = setupRequestId;

    dispatch(setProctoringSetupStarting());
    setMediaStream((currentStream) => {
      stopMediaTracks(currentStream);
      return null;
    });

    const isFullscreenReady = await requestFullscreenIfNeeded();
    if (!isFullscreenReady) {
      if (activeSetupRequestRef.current !== setupRequestId) {
        return;
      }

      dispatch(setProctoringPermissionError(PROCTORING_FULLSCREEN_REQUIRED_MESSAGE));
      return;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: true,
      });

      if (activeSetupRequestRef.current !== setupRequestId) {
        stopMediaTracks(nextStream);
        return;
      }

      setMediaStream(nextStream);
      dispatch(resetProctoring());
      dispatch(startProctoring());
      dispatch(setProctoringReady());
    } catch {
      if (activeSetupRequestRef.current !== setupRequestId) {
        return;
      }

      dispatch(setProctoringPermissionError(await getPermissionErrorMessage()));
    }
  }, [dispatch]);

  const retryProctoringSetup = () => {
    void requestMediaAccess();
  };

  const handleMonitoringError = useCallback(
    (message: string) => {
      triggerToast({
        title: "Face Monitoring Error",
        description: message,
        type: "error",
      });
    },
    [triggerToast],
  );

  useEffect(() => {
    if (!initialMediaStream) {
      return;
    }

    initialMediaStream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        dispatch(
          setProctoringPermissionError("Camera access was revoked. Re-enable camera permissions to continue."),
        );
      });
    });

    dispatch(resetProctoring());
    dispatch(startProctoring());
    dispatch(setProctoringReady());
    setMediaStream(initialMediaStream);
  }, [dispatch, initialMediaStream]);

  useEffect(() => {
    let cleanup = () => {};

    if (isExamReady && !skipAutoSetup && !initialMediaStream) {
      const setupTimeoutId = window.setTimeout(() => {
        void requestMediaAccess();
      }, 0);

      cleanup = () => {
        window.clearTimeout(setupTimeoutId);
        activeSetupRequestRef.current += 1;
        stopProctoringSession();
      };
    }

    return cleanup;
  }, [initialMediaStream, isExamReady, requestMediaAccess, skipAutoSetup, stopProctoringSession]);

  useEffect(() => {
    const video = videoRef.current;
    let cleanup = () => {};

    if (video && video.srcObject !== mediaStream) {
      video.srcObject = mediaStream;

      if (mediaStream) {
        void video.play().catch(() => {});
      }

      cleanup = () => {
        video.srcObject = null;
      };
    }

    return cleanup;
  });

  const isMonitoringActive = isExamReady && isProctoringActive && Boolean(mediaStream);

  useBrowserMonitoring(isMonitoringActive);
  useHeadEyeMonitoring({
    isActive: isMonitoringActive,
    videoRef,
    mediaStream,
    onMonitoringError: handleMonitoringError,
  });
  useObjectDetection({ isActive: isMonitoringActive, videoRef, mediaStream });
  useVoiceDetection({ isActive: isMonitoringActive, mediaStream });
  useKeyboardMonitoring(isMonitoringActive);
  useIdleDetection(isMonitoringActive);
  useDevToolsDetection(isMonitoringActive);
  useDoubleDisplayMonitoring({
    isActive: isMonitoringActive,
    timeoutSeconds: doubleDisplayTimeoutSeconds,
  });

  return {
    videoRef,
    mediaStream,
    retryProctoringSetup,
    stopProctoringSession,
  };
};

export default useProctoring;
