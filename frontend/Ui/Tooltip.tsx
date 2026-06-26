"use client";

import { ReactNode, useState } from "react";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
};

const Tooltip = ({ content, children, disabled = false, className = "" }: TooltipProps) => {
  const [visible, setVisible] = useState(false);

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-[8px] bg-[#232A25] px-3 py-2 text-xs text-white shadow-lg"
          style={{ fontFamily: "Instrument Sans, sans-serif" }}
        >
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
