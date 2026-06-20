import { addFlag } from "@/lib/features/proctoringSlice";
import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";

const IDLE_LIMIT_MS = 45000;
const CHECK_INTERVAL_MS = 5000;

const useIdleDetection = (isActive: boolean) => {
  const dispatch = useAppDispatch();
  const lastActivityAtRef = useRef(0);

  useEffect(() => {
    let cleanup = () => {};

    if (isActive) {
      lastActivityAtRef.current = Date.now();

      const markActivity = () => {
        lastActivityAtRef.current = Date.now();
      };

      const intervalId = window.setInterval(() => {
        const idleTime = Date.now() - lastActivityAtRef.current;

        if (idleTime >= IDLE_LIMIT_MS) {
          dispatch(
            addFlag({
              type: "idle-too-long",
              message: "No mouse or keyboard activity was detected for 45 seconds.",
            }),
          );
          lastActivityAtRef.current = Date.now();
        }
      }, CHECK_INTERVAL_MS);

      document.addEventListener("mousemove", markActivity);
      document.addEventListener("keydown", markActivity);
      document.addEventListener("click", markActivity);
      document.addEventListener("touchstart", markActivity);

      cleanup = () => {
        window.clearInterval(intervalId);
        document.removeEventListener("mousemove", markActivity);
        document.removeEventListener("keydown", markActivity);
        document.removeEventListener("click", markActivity);
        document.removeEventListener("touchstart", markActivity);
      };
    }

    return cleanup;
  }, [dispatch, isActive]);
};

export default useIdleDetection;
