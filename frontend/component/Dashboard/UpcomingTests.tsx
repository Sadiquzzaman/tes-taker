"use client";

import React from "react";
import Link from "next/link";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";
import { formatExamDuration, formatExamStart } from "@/utils/Dashboard/format";

const UpcomingTests = () => {
  const { data, loading } = useDashboard();
  const upcomingTests = data?.upcoming_tests ?? [];

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Upcoming Tests</div>
        <Link href="/tests" className="flex items-center text-[#49734F]">
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">View All </div>
          <RightArrowIconSVG />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4">
          <DashboardWidgetSkeleton lines={6} />
        </div>
      ) : upcomingTests.length === 0 ? (
        <div className="mt-4 flex-1">
          <DashboardEmptyState
            title="No upcoming tests"
            description="Scheduled tests will appear here."
            ctaLabel="Create Test"
            ctaHref="/tests/create"
          />
        </div>
      ) : (
        <div className="mt-4 max-h-[200px] overflow-y-auto overflow-x-auto">
          <table className="min-w-[400px] w-full table-fixed">
            <thead>
              <tr className="text-left font-[500] text-[12px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3]">
                <th className="p-2 w-[30%] whitespace-nowrap">Test</th>
                <th className="p-2 whitespace-nowrap">Class</th>
                <th className="p-2 w-[105px] whitespace-nowrap">Starts</th>
                <th className="p-2 whitespace-nowrap">Duration</th>
                <th className="p-2 whitespace-nowrap">Students</th>
              </tr>
            </thead>
            <tbody>
              {upcomingTests.map((upcomingTest) => (
                <tr
                  key={upcomingTest.id}
                  className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]"
                >
                  <td className="w-[30%] truncate p-2 whitespace-nowrap">{upcomingTest.test_name ?? "Untitled test"}</td>
                  <td className="p-2 whitespace-nowrap">{upcomingTest.class_name ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">{formatExamStart(upcomingTest.exam_start_time)}</td>
                  <td className="p-2 whitespace-nowrap">{formatExamDuration(upcomingTest.duration_minutes)}</td>
                  <td className="p-2 whitespace-nowrap">{upcomingTest.student_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UpcomingTests;
