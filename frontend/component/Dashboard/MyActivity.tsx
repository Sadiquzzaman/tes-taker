"use client";

import React from "react";
import { LineChart, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";
import ChevronDownFilledIconSVG from "../svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "../svg/ChevronUpFilledIconSVG";
import { useMyActivity } from "@/hooks/Dashboard/useMyActivity";
import { activityData, sampleActivityDuration } from "@/utils/Dashboard/activity";

const MyActivity = () => {
  const { open, setOpen, selectedDuration, setSelectedDuration, dropdownRef, isAnimationActive } = useMyActivity();

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
              {sampleActivityDuration.map((duration) => (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDuration(duration);
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
            domain={[0, 50]}
            ticks={[0, 10, 20, 30, 40, 50]}
            interval={0}
            tick={{ fontSize: 10 }}
            tickCount={6}
            width={"auto"}
            tickLine={false}
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
