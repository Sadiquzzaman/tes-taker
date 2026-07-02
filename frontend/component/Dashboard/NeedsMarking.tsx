"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";

const NeedsMarking = () => {
  const { data, loading } = useDashboard();
  const count = data?.pending_grading_count ?? 0;

  return (
    <div className="bg-[#49734F] rounded-[12px] p-4 flex flex-col justify-between text-white w-full h-full min-h-[150px]">
      {loading ? (
        <DashboardWidgetSkeleton className="[&_div]:bg-white/20" />
      ) : count === 0 ? (
        <DashboardEmptyState
          variant="dark"
          title="Nothing to grade"
          description="Student submissions that need review will appear here."
          ctaLabel="Create Test"
          ctaHref="/tests/create"
        />
      ) : (
        <>
          <div>
            <div className="font-[500] text-[14px] leading-[16px] text-white tracking-[-0.02em]">Needs marking</div>
            <div className="font-[400] text-[16px] leading-[100%] text-white tracking-[-0.02em] mt-3">
              <span className="font-[600]">
                {count} submission{count === 1 ? "" : "s"}
              </span>{" "}
              waiting for review. Finish marking to publish results.
            </div>
          </div>
          <Link
            href="/grading"
            className="bg-white text-[#49734F] flex items-center gap-2 rounded-[8px] px-4 py-2 w-fit mt-4"
          >
            <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em] mb-[2px]">Go to Marking</p>
            <RightArrowIconSVG className="size-4 mt-[2px]" strokeWidth={2} />
          </Link>
        </>
      )}
    </div>
  );
};

export default NeedsMarking;
