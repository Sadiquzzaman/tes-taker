import { addFlag, disqualifyExam, setProctoringCountdown } from "@/lib/features/proctoringSlice";
import { useAppDispatch } from "@/lib/hooks";
import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import {
  initScreenShareMonitor,
  isScreenSharingActive,
  subscribeScreenShare,
} from "@/utils/tests/screenShareMonitor";
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 1000;

interface ScreenShareMonitoringOptions {
  isActive: boolean;
  requiredScreenShare?: boolean;
  timeoutSeconds?: number;
}

const useScreenShareMonitoring = ({
  isActive,
  requiredScreenShare = true,
  timeoutSeconds = PROCTORING_CONFIG.screenShareTimeout,
}: ScreenShareMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const violationStartedAtRef = useRef<number | null>(null);
  const hasDisqualifiedRef = useRef(false);

  useEffect(() => {
    let cleanup = () => {};

    if (!isActive || !requiredScreenShare) {
      violationStartedAtRef.current = null;
      hasDisqualifiedRef.current = false;
      dispatch(setProctoringCountdown(null));
      return cleanup;
    }

    initScreenShareMonitor();
    const disqualifyAfterMs = Math.max(5, timeoutSeconds) * 1000;

    const syncScreenShareState = () => {
      if (hasDisqualifiedRef.current) {
        return;
      }

      const isSharing = isScreenSharingActive();

      if (isSharing) {
        violationStartedAtRef.current = null;
        dispatch(setProctoringCountdown(null));
        return;
      }

      if (!violationStartedAtRef.current) {
        violationStartedAtRef.current = Date.now();
        dispatch(
          addFlag({
            type: "screen-share-stopped",
            message: "Screen sharing stopped. Resume within the countdown to avoid disqualification.",
          }),
        );
      }

      const elapsed = Date.now() - (violationStartedAtRef.current ?? Date.now());
      const secondsRemaining = Math.max(0, Math.ceil((disqualifyAfterMs - elapsed) / 1000));

      dispatch(
        setProctoringCountdown({
          type: "screen-share",
          secondsRemaining,
          message: "Screen sharing stopped. Resume sharing to continue the exam.",
        }),
      );

      if (elapsed >= disqualifyAfterMs) {
        hasDisqualifiedRef.current = true;
        dispatch(setProctoringCountdown(null));
        dispatch(
          disqualifyExam({
            type: "screen-share-stopped",
            message: `Screen sharing was not resumed within ${timeoutSeconds} seconds.`,
          }),
        );
      }
    };

    void syncScreenShareState();
    const unsubscribe = subscribeScreenShare(() => {
      void syncScreenShareState();
    });
    const intervalId = window.setInterval(() => {
      void syncScreenShareState();
    }, POLL_INTERVAL_MS);

    cleanup = () => {
      window.clearInterval(intervalId);
      unsubscribe();
      violationStartedAtRef.current = null;
      hasDisqualifiedRef.current = false;
    };

    return cleanup;
  }, [dispatch, isActive, requiredScreenShare, timeoutSeconds]);
};

export default useScreenShareMonitoring;
