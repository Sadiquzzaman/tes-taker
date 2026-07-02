"use client";

import React from "react";
import Link from "next/link";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";

const TotalStudents = () => {
  const { data, loading } = useDashboard();
  const summary = data?.students_summary;
  const total = summary?.total ?? 0;
  const active = summary?.active ?? 0;
  const pending = summary?.pending ?? 0;

  return (
    <div className="bg-[#ffffff] p-4 rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Total Students</div>
        <Link href="/classes" className="flex items-center text-[#49734F]">
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">Add Student </div>
          <RightArrowIconSVG />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 flex-1">
          <DashboardWidgetSkeleton lines={4} />
        </div>
      ) : total === 0 ? (
        <div className="mt-4 flex-1">
          <DashboardEmptyState
            title="0 Students"
            description="Add students to your classes to start tracking performance."
            ctaLabel="Add Students"
            ctaHref="/classes"
          />
        </div>
      ) : (
        <div className="bg-white flex items-center justify-center w-full h-full">
          <div className="relative w-[193px] h-[162px] mx-auto">
            <div className="absolute left-[84px] top-[36px] w-[109px] h-[109px]">
              <div className="w-full h-full rounded-full bg-[#49734F] opacity-90"></div>
              <div className="absolute inset-0 rounded-full border-[2.1px] border-[#49734F]"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
                <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">{total}</div>
                <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Total Students</div>
              </div>
            </div>

            <div className="absolute left-[35px] top-[20px] w-[70px] h-[70px]">
              <div className="w-full h-full rounded-full bg-[#459A7D] opacity-80"></div>
              <div className="absolute inset-0 rounded-full border border-[#459A7D]"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
                <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">{active}</div>
                <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Active</div>
              </div>
            </div>

            <div className="absolute left-[0px] bottom-[0px] w-[77px] h-[77px]">
              <div className="w-full h-full rounded-full bg-[#232A25] opacity-90"></div>
              <div className="absolute inset-0 rounded-full border-[1.5px] border-[#232A25]"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
                <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">{pending}</div>
                <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Pending</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalStudents;
