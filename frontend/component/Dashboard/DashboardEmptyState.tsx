import React from "react";
import Link from "next/link";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";

type DashboardEmptyStateProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
  variant?: "light" | "dark";
};

const DashboardEmptyState = ({
  title,
  description,
  ctaLabel,
  ctaHref,
  className = "",
  variant = "light",
}: DashboardEmptyStateProps) => {
  const isDark = variant === "dark";

  return (
    <div className={`flex flex-col justify-between h-full flex-1 ${className}`}>
      <div>
        <div
          className={`font-[500] text-[14px] leading-[16px] tracking-[-0.02em] ${isDark ? "text-white" : "text-[#232A25]"}`}
        >
          {title}
        </div>
        <div
          className={`font-[400] text-[14px] leading-[140%] tracking-[-0.02em] mt-3 ${isDark ? "text-white/90" : "text-[#747775]"}`}
        >
          {description}
        </div>
      </div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className={`mt-4 flex items-center gap-2 rounded-[8px] px-4 py-2 w-fit ${
            isDark ? "bg-white text-[#49734F]" : "bg-[#49734F] text-white"
          }`}
        >
          <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em] mb-[2px]">{ctaLabel}</p>
          <RightArrowIconSVG className="size-4 mt-[2px]" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
};

export default DashboardEmptyState;
