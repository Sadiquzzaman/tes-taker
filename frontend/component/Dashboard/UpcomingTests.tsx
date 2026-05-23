import React from "react";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import { sampleUpcomingTests } from "@/utils/Dashboard/upcomingTests";

const UpcomingTests = () => (
  <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="flex justify-between items-center">
      <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Upcoming Tests</div>
      <button className="flex items-center text-[#49734F]">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">View All </div>
        <RightArrowIconSVG />
      </button>
    </div>

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
          {sampleUpcomingTests.map((upcomingTest, index) => (
            <tr
              key={`${upcomingTest.test}-${index}`}
              className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]"
            >
              <td className="w-[30%] truncate p-2 whitespace-nowrap">{upcomingTest.test}</td>
              <td className="p-2 whitespace-nowrap">{upcomingTest.className}</td>
              <td className="p-2 whitespace-nowrap">{upcomingTest.starts}</td>
              <td className="p-2 whitespace-nowrap">{upcomingTest.duration}</td>
              <td className="p-2 whitespace-nowrap">{upcomingTest.students}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default UpcomingTests;
