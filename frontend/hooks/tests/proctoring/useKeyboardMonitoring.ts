import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import { createFlagReporter } from "./proctoringMonitorUtils";

const FLAG_COOLDOWN_MS = 1200;
const BLOCKED_CONTROL_KEYS = new Set(["c", "v", "x", "t", "r", "p", "s"]);
const BLOCKED_DEVTOOLS_KEYS = new Set(["i", "j", "c"]);

const useKeyboardMonitoring = (isActive: boolean) => {
  const dispatch = useAppDispatch();
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});

  useEffect(() => {
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault();
      reportFlag("paste-attempt", "Paste attempt was blocked.");
    };

    const handleRestrictedAction = (event: Event) => {
      event.preventDefault();
      reportFlag("restricted-action", "Restricted browser action was blocked.");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasControlKey = event.ctrlKey || event.metaKey;
      const isBlockedControlKey = hasControlKey && BLOCKED_CONTROL_KEYS.has(key);
      const isDevToolsShortcut = hasControlKey && event.shiftKey && BLOCKED_DEVTOOLS_KEYS.has(key);

      if (event.key === "F12" || isBlockedControlKey || isDevToolsShortcut) {
        event.preventDefault();
        reportFlag(key === "v" ? "paste-attempt" : "restricted-action", "Restricted shortcut was blocked.");
      }
    };

    if (isActive) {
      document.addEventListener("copy", handleRestrictedAction);
      document.addEventListener("cut", handleRestrictedAction);
      document.addEventListener("paste", handlePaste);
      document.addEventListener("contextmenu", handleRestrictedAction);
      document.addEventListener("keydown", handleKeyDown);

      cleanup = () => {
        document.removeEventListener("copy", handleRestrictedAction);
        document.removeEventListener("cut", handleRestrictedAction);
        document.removeEventListener("paste", handlePaste);
        document.removeEventListener("contextmenu", handleRestrictedAction);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    return cleanup;
  }, [dispatch, isActive]);
};

export default useKeyboardMonitoring;
