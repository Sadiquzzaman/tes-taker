import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import isVideoFrameReady from "./isVideoFrameReady";
import { createFlagReporter, DEFAULT_FLAG_COOLDOWN_MS } from "./proctoringMonitorUtils";

const CHECK_INTERVAL_MS = 7000;
const PHONE_SCORE_THRESHOLD = 0.45;

const useObjectDetection = ({ isActive, videoRef, mediaStream }: VideoMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});

  useEffect(() => {
    const canMonitor = isActive && Boolean(mediaStream);
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, DEFAULT_FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    if (canMonitor) {
      let isStopped = false;
      let intervalId: number | null = null;
      let isProcessingFrame = false;

      const startMonitoring = async () => {
        const tf = await import("@tensorflow/tfjs");
        await tf.setBackend("cpu");
        await tf.ready();

        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        const detector = await cocoSsd.load();

        if (isStopped) {
          return;
        }

        intervalId = window.setInterval(() => {
          const video = videoRef.current;
          if (!isVideoFrameReady(video) || isProcessingFrame) {
            return;
          }

          isProcessingFrame = true;

          try {
            void detector
              .detect(video)
              .then((predictions) => {
                const hasPhone = predictions.some(
                  (prediction) => prediction.class === "cell phone" && prediction.score >= PHONE_SCORE_THRESHOLD,
                );

                if (hasPhone) {
                  reportFlag("phone-detected", "A phone was detected in the webcam frame.");
                }
              })
              .catch(() => {})
              .finally(() => {
                isProcessingFrame = false;
              });
          } catch {
            isProcessingFrame = false;
          }
        }, CHECK_INTERVAL_MS);
      };

      void startMonitoring().catch(() => {});

      cleanup = () => {
        isStopped = true;

        if (intervalId !== null) {
          window.clearInterval(intervalId);
        }
      };
    }

    return cleanup;
  }, [dispatch, isActive, mediaStream, videoRef]);
};

export default useObjectDetection;
