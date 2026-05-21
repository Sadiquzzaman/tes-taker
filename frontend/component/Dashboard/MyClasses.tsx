"use client";

import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { classesData } from "@/utils/Dashboard/classes";

const MyClasses = () => (
  <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="flex justify-between items-center">
      <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">My Classes</div>
      <button className="flex items-center text-[#49734F]">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">View All </div>
        <RightArrowIconSVG />
      </button>
    </div>
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
        <YAxis
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          interval={0}
          tick={{ fontSize: 10 }}
          tickCount={6}
          width={"auto"}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="student" fill="#49734F" activeBar={{ fill: "#49734F", stroke: "#49734F" }} />
      </BarChart>
    </div>
  </div>
);

export default MyClasses;

const CustomTooltip = ({ active, payload, label }: ClassesTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white shadow-lg rounded-lg px-4 py-3 text-xs">
      <p className="font-[500] text-[12px] leading-[14px] tracking-[-0.02em] text-[#49734F]">
        {payload[0].value} Students
      </p>
      <p className="mt-1 font-[400] text-[10px] leading-[12px] tracking-[-0.02em] text-[#747775]">{label}</p>
    </div>
  );
};
