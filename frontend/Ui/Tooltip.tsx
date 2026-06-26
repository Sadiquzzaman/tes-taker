"use client";

import { ReactNode, useRef, useState } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

const Tooltip = ({ content, children, disabled = false, className = "" }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setVisible(true);
  };

  // Small delay so the cursor can travel into the tooltip (e.g. to click a link)
  // without it disappearing.
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 200);
  };

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          // pb-2 acts as a hoverable "bridge" so there is no empty gap between the
          // trigger and the tooltip bubble for the cursor to fall through.
          className="absolute bottom-full left-1/2 z-50 flex -translate-x-1/2 justify-center pb-2"
        >
          <span
            className="w-max max-w-[220px] rounded-[8px] bg-[#232A25] px-3 py-2 text-xs text-white shadow-lg"
            style={{ fontFamily: "Instrument Sans, sans-serif" }}
          >
            {content}
          </span>
        </span>
      )}
    </span>
  );
};

export default Tooltip;
