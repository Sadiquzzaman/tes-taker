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
import { useCallback, useEffect, useRef, useState } from "react";
import useBrowserMonitoring from "./useBrowserMonitoring";
import useDevToolsDetection from "./useDevToolsDetection";
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
import useScreenSharingMonitoring from "./useScreenSharingMonitoring";
import useVoiceDetection from "./useVoiceDetection";

const useProctoring = ({ isExamReady }: UseProctoringOptions): UseProctoringResult => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const isProctoringActive = useAppSelector(selectIsProctoringActive);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const activeSetupRequestRef = useRef(0);

  const stopProctoringSession = useCallback(() => {
    setMediaStream((currentStream) => {
      stopMediaTracks(currentStream);
      return null;
    });
    dispatch(stopProctoring());
  }, [dispatch]);

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
    let cleanup = () => {};

    if (isExamReady) {
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
  }, [isExamReady, requestMediaAccess, stopProctoringSession]);

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
  useScreenSharingMonitoring(isMonitoringActive);

  return {
    videoRef,
    retryProctoringSetup,
    stopProctoringSession,
  };
};

export default useProctoring;
