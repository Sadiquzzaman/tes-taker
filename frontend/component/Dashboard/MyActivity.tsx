"use client";

import React, { useRef, useState } from "react";
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from "recharts";

const data = [
  {
    name: "Jan",
    exam: 30,
    participate: 1100,
  },
  {
    name: "Feb",
    exam: 25,
    participate: 1000,
  },
  {
    name: "Mar",
    exam: 42,
    participate: 1200,
  },
  {
    name: "Apr",
    exam: 38,
    participate: 900,
  },
  {
    name: "May",
    exam: 25,
    participate: 1000,
  },
  {
    name: "Jun",
    exam: 45,
    participate: 1100,
  },
  {
    name: "Jul",
    exam: 36,
    participate: 1200,
  },
  {
    name: "Aug",
    exam: 44,
    participate: 1250,
  },
  {
    name: "Sep",
    exam: 27,
    participate: 1300,
  },
  {
    name: "Oct",
    exam: 44,
    participate: 1400,
  },
  {
    name: "Nov",
    exam: 43,
    participate: 1500,
  },
  {
    name: "Dec",
    exam: 41,
    participate: 1600,
  },
];

const sampleActivityDuration = [
  { name: "Monthly", value: "monthly" },
  { name: "Weekly", value: "weekly" },
  { name: "Daily", value: "daily" },
];
const MyActivity = () => {
  const [open, setOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(sampleActivityDuration[0]);
  const dropdownRef = useRef(null);
  const isAnimationActive = true;
  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[220px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">My Activity</div>
        <div ref={dropdownRef} className="relative inline-block">
          <button className="flex items-center text-[#747775]" onClick={() => setOpen(!open)}>
            <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">{selectedDuration.name}</div>
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4 ml-2 mt-[2px]"
              >
                <path
                  fillRule="evenodd"
                  d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4 ml-2 mt-[2px]"
              >
                <path
                  fillRule="evenodd"
                  d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-200 rounded shadow-lg z-50">
              {sampleActivityDuration.map((duration) => (
                <button
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
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {/* <CartesianGrid strokeDasharray="3 3" /> */}
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
              strokeDasharray: "4 4", // 👈 makes it dotted
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

const CustomTooltip = (props: any) => {
  const { active, payload, label, ...rest } = props;
  console.log({ payload, label, rest });
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
