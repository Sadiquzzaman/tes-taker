import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import { createFlagReporter, DEFAULT_FLAG_COOLDOWN_MS } from "./proctoringMonitorUtils";

const CHECK_INTERVAL_MS = 2000;
const DEVTOOLS_GAP_THRESHOLD = 160;

const useDevToolsDetection = (isActive: boolean) => {
  const dispatch = useAppDispatch();
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});

  useEffect(() => {
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, DEFAULT_FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    if (isActive) {
      const intervalId = window.setInterval(() => {
        const widthGap = window.outerWidth - window.innerWidth;
        const heightGap = window.outerHeight - window.innerHeight;
        const isDevToolsLikelyOpen = widthGap > DEVTOOLS_GAP_THRESHOLD || heightGap > DEVTOOLS_GAP_THRESHOLD;

        if (isDevToolsLikelyOpen) {
          reportFlag("devtools-open", "Browser developer tools appear to be open.");
        }
      }, CHECK_INTERVAL_MS);

      cleanup = () => window.clearInterval(intervalId);
    }

    return cleanup;
  }, [dispatch, isActive]);
};

export default useDevToolsDetection;
