import { requestFullscreenIfNeeded } from "@/hooks/tests/proctoring/proctoringMonitorUtils";
import { useCallback, useEffect, useState } from "react";

const useExamFullscreen = (active: boolean) => {
  const [needsFullscreen, setNeedsFullscreen] = useState(false);

  useEffect(() => {
    if (!active) {
      setNeedsFullscreen(false);
      return;
    }

    const syncFullscreenState = () => {
      setNeedsFullscreen(!document.fullscreenElement);
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    window.addEventListener("focus", syncFullscreenState);
    document.addEventListener("visibilitychange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      window.removeEventListener("focus", syncFullscreenState);
      document.removeEventListener("visibilitychange", syncFullscreenState);
    };
  }, [active]);

  const restoreFullscreen = useCallback(async () => {
    if (!active || document.fullscreenElement) {
      return;
    }

    const isFullscreenReady = await requestFullscreenIfNeeded();
    setNeedsFullscreen(!isFullscreenReady);
  }, [active]);

  useEffect(() => {
    if (!active || !needsFullscreen) {
      return;
    }

    const handlePointerDown = () => {
      void restoreFullscreen();
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [active, needsFullscreen, restoreFullscreen]);

  return { needsFullscreen, restoreFullscreen };
};

export default useExamFullscreen;
