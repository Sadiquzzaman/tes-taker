"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";
import ChevronDownFilledIconSVG from "../svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "../svg/ChevronUpFilledIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";

const ACTIVITY_DURATIONS: Array<{ name: string; value: DashboardActivityPeriod }> = [
  { name: "Monthly", value: "monthly" },
  { name: "Weekly", value: "weekly" },
  { name: "Daily", value: "daily" },
];

const MyActivity = () => {
  const { data, loading, activityPeriod, setActivityPeriod } = useDashboard();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAnimationActive = true;

  const selectedDuration = ACTIVITY_DURATIONS.find((item) => item.value === activityPeriod) ?? ACTIVITY_DURATIONS[0];

  const activityData = useMemo(
    () =>
      (data?.activity.data ?? []).map((point) => ({
        name: point.label,
        exam: point.exam_count,
        participate: point.participant_count,
      })),
    [data?.activity.data],
  );

  const hasActivity = activityData.some((point) => point.exam > 0 || point.participate > 0);
  const maxExam = Math.max(0, ...activityData.map((point) => point.exam));
  const yMax = maxExam <= 0 ? 10 : Math.ceil(maxExam / 10) * 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[220px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">My Activity</div>
        <div ref={dropdownRef} className="relative inline-block">
          <button type="button" className="flex items-center text-[#747775]" onClick={() => setOpen(!open)}>
            <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">{selectedDuration.name}</div>
            {open ? (
              <ChevronUpFilledIconSVG className="size-4 ml-2 mt-[2px]" />
            ) : (
              <ChevronDownFilledIconSVG className="size-4 ml-2 mt-[2px]" />
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-200 rounded shadow-lg z-50">
              {ACTIVITY_DURATIONS.map((duration) => (
                <button
                  type="button"
                  onClick={() => {
                    setActivityPeriod(duration.value);
                    setOpen(false);
                  }}
                  key={duration.value}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  {duration.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-[170px]">
          <DashboardWidgetSkeleton lines={5} />
        </div>
      ) : !hasActivity ? (
        <div className="mt-4 h-[170px] flex items-center justify-center rounded-[8px] border border-dashed border-[#EFF0F3]">
          <p className="font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] text-center px-4">
            Activity insights will appear once students begin taking tests.
          </p>
        </div>
      ) : (
        <div className="mt-4 h-[170px]">
          <LineChart
            style={{ width: "100%", maxWidth: "700px", height: "100%", aspectRatio: 1.618 }}
            responsive
            data={activityData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <XAxis dataKey="name" tickLine={false} />
            <YAxis
              domain={[0, yMax]}
              interval={0}
              tick={{ fontSize: 10 }}
              width={"auto"}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{
                stroke: "#49734F",
                strokeWidth: 2,
                strokeDasharray: "4 4",
              }}
              content={<CustomTooltip />}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="exam"
              stroke="#49734F"
              strokeWidth={2}
              isAnimationActive={isAnimationActive}
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </div>
      )}
    </div>
  );
};

export default MyActivity;

const CustomTooltip = ({ active, payload }: ActivityTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white shadow-lg rounded-lg px-4 py-3 text-xs">
      <p className="font-[500] text-[12px] leading-[14px] tracking-[-0.02em] text-[#49734F]">
        {payload[0].value} Exams
      </p>
      <p className="mt-1 font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">
        {payload[0].payload.participate} Participants
      </p>
    </div>
  );
};
