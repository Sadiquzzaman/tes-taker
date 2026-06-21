import { addFlag, disqualifyExam, setProctoringCountdown } from "@/lib/features/proctoringSlice";
import { useAppDispatch } from "@/lib/hooks";
import { hasMultipleDisplays, requestDisplayEnvironmentAccess } from "@/utils/tests/displayEnvironment";
import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 1000;

interface DoubleDisplayMonitoringOptions {
  isActive: boolean;
  timeoutSeconds?: number;
}

const useDoubleDisplayMonitoring = ({
  isActive,
  timeoutSeconds = PROCTORING_CONFIG.doubleDisplayTimeout,
}: DoubleDisplayMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const violationStartedAtRef = useRef<number | null>(null);
  const hasDisqualifiedRef = useRef(false);

  useEffect(() => {
    let cleanup = () => {};

    if (!isActive) {
      violationStartedAtRef.current = null;
      hasDisqualifiedRef.current = false;
      dispatch(setProctoringCountdown(null));
      return cleanup;
    }

    void requestDisplayEnvironmentAccess();
    const disqualifyAfterMs = Math.max(5, timeoutSeconds) * 1000;

    const syncDisplayState = async () => {
      if (hasDisqualifiedRef.current) {
        return;
      }

      const multipleDisplays = await hasMultipleDisplays();

      if (!multipleDisplays) {
        violationStartedAtRef.current = null;
        dispatch(setProctoringCountdown(null));
        return;
      }

      if (!violationStartedAtRef.current) {
        violationStartedAtRef.current = Date.now();
        dispatch(
          addFlag({
            type: "double-display",
            message: "Multiple displays detected. Disconnect extra displays within the countdown.",
          }),
        );
      }

      const elapsed = Date.now() - (violationStartedAtRef.current ?? Date.now());
      const secondsRemaining = Math.max(0, Math.ceil((disqualifyAfterMs - elapsed) / 1000));

      dispatch(
        setProctoringCountdown({
          type: "double-display",
          secondsRemaining,
          message: "Multiple displays detected. Use a single display to continue the exam.",
        }),
      );

      if (elapsed >= disqualifyAfterMs) {
        hasDisqualifiedRef.current = true;
        dispatch(setProctoringCountdown(null));
        dispatch(
          disqualifyExam({
            type: "double-display",
            message: `Multiple displays were not resolved within ${timeoutSeconds} seconds.`,
          }),
        );
      }
    };

    void syncDisplayState();
    const intervalId = window.setInterval(() => {
      void syncDisplayState();
    }, POLL_INTERVAL_MS);

    cleanup = () => {
      window.clearInterval(intervalId);
      violationStartedAtRef.current = null;
      hasDisqualifiedRef.current = false;
    };

    return cleanup;
  }, [dispatch, isActive, timeoutSeconds]);
};

export default useDoubleDisplayMonitoring;
