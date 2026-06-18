import { disqualifyExam } from "@/lib/features/proctoringSlice";
import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 3000;

const useScreenSharingMonitoring = ({
  isActive,
  allowScreenShare = false,
  screenShareDisqualifySeconds = 15,
}: ScreenSharingMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const violationStartedAtRef = useRef<number | null>(null);
  const hasDisqualifiedRef = useRef(false);

  useEffect(() => {
    let cleanup = () => {};
    const disqualifyAfterMs = screenShareDisqualifySeconds * 1000;

    if (!isActive || allowScreenShare) {
      violationStartedAtRef.current = null;
      hasDisqualifiedRef.current = false;
    }

    const hasMultipleDisplays = async () => {
      if (window.screen.isExtended) {
        return true;
      }

      if (!window.getScreenDetails) {
        return false;
      }

      try {
        const screenDetails = await window.getScreenDetails();
        return screenDetails.screens.length > 1;
      } catch {
        return false;
      }
    };

    const checkScreenState = async () => {
      const isInactiveTab = document.visibilityState === "hidden";
      const isMultipleDisplaySession = await hasMultipleDisplays();
      const hasViolation = isInactiveTab || isMultipleDisplaySession;

      if (!hasViolation) {
        violationStartedAtRef.current = null;
        return;
      }

      if (!violationStartedAtRef.current) {
        violationStartedAtRef.current = Date.now();
        return;
      }

      const violationDuration = Date.now() - violationStartedAtRef.current;
      if (violationDuration >= disqualifyAfterMs && !hasDisqualifiedRef.current) {
        hasDisqualifiedRef.current = true;
        dispatch(
          disqualifyExam({
            type: "screen-sharing",
            message: `Screen sharing, inactive tab, or multiple display activity continued for ${screenShareDisqualifySeconds} seconds.`,
          }),
        );
      }
    };

    if (isActive && !allowScreenShare) {
      void checkScreenState();
      const intervalId = window.setInterval(() => {
        void checkScreenState();
      }, CHECK_INTERVAL_MS);

      cleanup = () => window.clearInterval(intervalId);
    }

    return cleanup;
  }, [allowScreenShare, dispatch, isActive, screenShareDisqualifySeconds]);
};

export default useScreenSharingMonitoring;
