"use client";

import { memo, useEffect, useRef } from "react";

interface ProctoringVideoPreviewProps {
  mediaStream: MediaStream | null;
  className?: string;
  ariaLabel?: string;
}

const ProctoringVideoPreview = ({
  mediaStream,
  className = "h-[160px] w-full rounded-[10px] bg-[#0F1A12] object-cover",
  ariaLabel = "Webcam preview",
}: ProctoringVideoPreviewProps) => {
  const previewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = previewRef.current;

    if (!video) {
      return;
    }

    video.srcObject = mediaStream;

    if (mediaStream) {
      void video.play().catch(() => {});
    }

    return () => {
      video.srcObject = null;
    };
  }, [mediaStream]);

  return <video ref={previewRef} muted playsInline autoPlay className={className} aria-label={ariaLabel} />;
};

export default memo(ProctoringVideoPreview);
