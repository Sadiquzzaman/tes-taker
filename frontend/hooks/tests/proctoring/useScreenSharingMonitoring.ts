import { disqualifyExam } from "@/lib/features/proctoringSlice";
import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 3000;
const DISQUALIFY_AFTER_MS = 15000;

const useScreenSharingMonitoring = (isActive: boolean) => {
  const dispatch = useAppDispatch();
  const violationStartedAtRef = useRef<number | null>(null);
  const hasDisqualifiedRef = useRef(false);

  useEffect(() => {
    let cleanup = () => {};

    if (!isActive) {
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
      if (violationDuration >= DISQUALIFY_AFTER_MS && !hasDisqualifiedRef.current) {
        hasDisqualifiedRef.current = true;
        dispatch(
          disqualifyExam({
            type: "screen-sharing",
            message: "Screen sharing, inactive tab, or multiple display activity continued for 15 seconds.",
          }),
        );
      }
    };

    if (isActive) {
      void checkScreenState();
      const intervalId = window.setInterval(() => {
        void checkScreenState();
      }, CHECK_INTERVAL_MS);

      cleanup = () => window.clearInterval(intervalId);
    }

    return cleanup;
  }, [dispatch, isActive]);
};

export default useScreenSharingMonitoring;
