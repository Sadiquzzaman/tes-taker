"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";

const MyClasses = () => {
  const { data, loading } = useDashboard();

  const classesData = useMemo(
    () =>
      (data?.classes_summary ?? []).map((cls) => ({
        name: cls.name.length > 12 ? `${cls.name.slice(0, 12)}…` : cls.name,
        student: cls.student_count,
        fullName: cls.name,
      })),
    [data?.classes_summary],
  );

  const maxStudents = Math.max(0, ...classesData.map((item) => item.student));
  const yMax = maxStudents <= 0 ? 10 : Math.ceil(maxStudents / 10) * 10;

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">My Classes</div>
        <Link href="/classes" className="flex items-center text-[#49734F]">
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">View All </div>
          <RightArrowIconSVG />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 h-[200px]">
          <DashboardWidgetSkeleton lines={5} />
        </div>
      ) : classesData.length === 0 ? (
        <div className="mt-4 flex-1">
          <DashboardEmptyState
            title="No classes created"
            description="Create your first class to start inviting students."
            ctaLabel="Create Class"
            ctaHref="/classes/create"
          />
        </div>
      ) : (
        <div className="mt-4 h-[200px]">
          <BarChart
            style={{ width: "100%", maxWidth: "700px", height: "100%", aspectRatio: 1.618 }}
            responsive
            data={classesData}
            margin={{
              top: 5,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
            <YAxis domain={[0, yMax]} interval={0} tick={{ fontSize: 10 }} width={"auto"} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="student" fill="#49734F" activeBar={{ fill: "#49734F", stroke: "#49734F" }} />
          </BarChart>
        </div>
      )}
    </div>
  );
};

export default MyClasses;

const CustomTooltip = ({ active, payload, label }: ClassesTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const fullName = (payload[0].payload as { fullName?: string }).fullName ?? label;

  return (
    <div className="bg-white shadow-lg rounded-lg px-4 py-3 text-xs">
      <p className="font-[500] text-[12px] leading-[14px] tracking-[-0.02em] text-[#49734F]">
        {payload[0].value} Students
      </p>
      <p className="mt-1 font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">{fullName}</p>
    </div>
  );
};
