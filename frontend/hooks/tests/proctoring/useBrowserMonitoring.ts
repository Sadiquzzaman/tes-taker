import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import { createFlagReporter } from "./proctoringMonitorUtils";

const FLAG_COOLDOWN_MS = 2500;

const useBrowserMonitoring = (isActive: boolean) => {
  const dispatch = useAppDispatch();
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});

  useEffect(() => {
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        reportFlag("tab-switch", "Student left the active test tab.");
      }
    };

    const handleWindowBlur = () => {
      reportFlag("window-blur", "Test window lost focus.");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportFlag("fullscreen-exit", "Student exited fullscreen mode.");
      }
    };

    const handleBeforeUnload = () => {
      reportFlag("restricted-action", "Page refresh or close was attempted.");
    };

    if (isActive) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      document.addEventListener("fullscreenchange", handleFullscreenChange);
      window.addEventListener("blur", handleWindowBlur);
      window.addEventListener("beforeunload", handleBeforeUnload);

      cleanup = () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        window.removeEventListener("blur", handleWindowBlur);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }

    return cleanup;
  }, [dispatch, isActive]);
};

export default useBrowserMonitoring;
