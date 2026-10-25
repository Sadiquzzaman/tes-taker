"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { cn } from "./cn";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  placement?: "top" | "bottom";
}

/**
 * A short note shown on hover or keyboard focus, e.g. why a button is locked. It can hold a link,
 * so it stays open while the pointer moves into it. Don't put essential information only here.
 */
const Tooltip = ({ content, children, disabled = false, className, placement = "top" }: TooltipProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setVisible(true);
  };

  // A short delay lets the pointer travel into the tooltip (e.g. to click a link) without it closing.
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 200);
  };

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <span
      className={cn("relative inline-flex", className)}
      aria-describedby={visible ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
      onKeyDown={(event) => {
        if (event.key === "Escape") setVisible(false);
      }}
    >
      {children}
      {visible ? (
        <span
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          // The padding is a hoverable bridge, so there is no gap for the pointer to fall through.
          className={cn("absolute left-1/2 z-50 flex -translate-x-1/2 justify-center", placement === "bottom" ? "top-full pt-2" : "bottom-full pb-2")}
        >
          <span className="w-max max-w-56 rounded-input bg-ink px-3 py-2 text-caption text-ink-inverse shadow-overlay">{content}</span>
        </span>
      ) : null}
    </span>
  );
};

export default Tooltip;
