import { useAppDispatch } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import { createFlagReporter, DEFAULT_FLAG_COOLDOWN_MS } from "./proctoringMonitorUtils";

const CHECK_INTERVAL_MS = 1000;
const VOICE_THRESHOLD = 0.06;
const REPEATED_ACTIVITY_COUNT = 3;

const useVoiceDetection = ({ isActive, mediaStream }: VoiceMonitoringOptions) => {
  const dispatch = useAppDispatch();
  const lastFlaggedAtRef = useRef<Partial<Record<ProctoringFlagType, number>>>({});

  useEffect(() => {
    const canMonitor = isActive && Boolean(mediaStream) && Boolean(mediaStream?.getAudioTracks().length);
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    const reportFlag = createFlagReporter(dispatch, lastFlaggedAtRef, DEFAULT_FLAG_COOLDOWN_MS);
    let cleanup = () => {};

    if (canMonitor && AudioContextConstructor && mediaStream) {
      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);
      let activeSampleCount = 0;

      analyser.fftSize = 1024;
      const data = new Uint8Array(analyser.fftSize);
      source.connect(analyser);

      const intervalId = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);

        const total = data.reduce((sum, value) => {
          const normalizedValue = (value - 128) / 128;
          return sum + normalizedValue * normalizedValue;
        }, 0);
        const volume = Math.sqrt(total / data.length);

        if (volume > VOICE_THRESHOLD) {
          activeSampleCount += 1;
        } else {
          activeSampleCount = 0;
        }

        if (activeSampleCount >= REPEATED_ACTIVITY_COUNT) {
          const didFlag = reportFlag("voice-detected", "Repeated microphone activity was detected.");

          if (didFlag) {
            activeSampleCount = 0;
          }
        }
      }, CHECK_INTERVAL_MS);

      cleanup = () => {
        window.clearInterval(intervalId);
        source.disconnect();
        analyser.disconnect();
        void audioContext.close();
      };
    }

    return cleanup;
  }, [dispatch, isActive, mediaStream]);
};

export default useVoiceDetection;
