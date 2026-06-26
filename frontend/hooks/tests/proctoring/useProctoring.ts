import {
  selectIsProctoringActive,
  resetProctoring,
  setProctoringFeatures,
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
  proctoringFeatures = {},
}: UseProctoringOptions): UseProctoringResult => {
  const dispatch = useAppDispatch();
  const { triggerToast } = useToast();
  const isProctoringActive = useAppSelector(selectIsProctoringActive);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(initialMediaStream);
  const activeSetupRequestRef = useRef(0);

  const featureEnabled = (key: string, defaultValue = true) =>
    proctoringFeatures[key] !== undefined ? Boolean(proctoringFeatures[key]) : defaultValue;

  useEffect(() => {
    dispatch(
      setProctoringFeatures({
        enableAutoDisqualification: featureEnabled("proctoring_auto_disqualification", true),
      }),
    );
  }, [dispatch, proctoringFeatures]);

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

  const browserMonitoringActive =
    isMonitoringActive &&
    (featureEnabled("proctoring_tab_switch") ||
      featureEnabled("proctoring_fullscreen_exit") ||
      featureEnabled("proctoring_page_refresh") ||
      featureEnabled("proctoring_browser_change"));

  useBrowserMonitoring(browserMonitoringActive);
  useHeadEyeMonitoring({
    isActive:
      isMonitoringActive &&
      (featureEnabled("proctoring_no_face") ||
        featureEnabled("proctoring_multiple_face") ||
        featureEnabled("proctoring_looking_away") ||
        featureEnabled("proctoring_video_monitoring")),
    videoRef,
    mediaStream,
    onMonitoringError: handleMonitoringError,
  });
  useObjectDetection({
    isActive: isMonitoringActive && (featureEnabled("proctoring_phone") || featureEnabled("proctoring_video_monitoring")),
    videoRef,
    mediaStream,
  });
  useVoiceDetection({
    isActive: isMonitoringActive && featureEnabled("proctoring_voice"),
    mediaStream,
  });
  useKeyboardMonitoring(isMonitoringActive && featureEnabled("proctoring_copy_paste"));
  useIdleDetection(isMonitoringActive && featureEnabled("proctoring_idle"));
  useDevToolsDetection(isMonitoringActive && featureEnabled("proctoring_devtools"));
  useDoubleDisplayMonitoring({
    isActive: isMonitoringActive && featureEnabled("proctoring_double_display"),
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
