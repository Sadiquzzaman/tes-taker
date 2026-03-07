import React from "react";

const UpcomingTests = () => (
  <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="flex justify-between items-center">
      <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Upcoming Tests</div>
      <button className="flex items-center text-[#49734F]">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">View All </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="size-4 ml-1 mt-[2px]"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
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
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">Algebra - Unit 2 Quiz</td>
            <td className="p-2 whitespace-nowrap">Class 9A</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 10:30 AM</td>
            <td className="p-2 whitespace-nowrap">30 m</td>
            <td className="p-2 whitespace-nowrap">28</td>
          </tr>
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">
              English Grammar Check English Grammar Check English Grammar Check
            </td>
            <td className="p-2 whitespace-nowrap">Class 8B</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 4:00 PM</td>
            <td className="p-2 whitespace-nowrap">01 h, 20 m</td>
            <td className="p-2 whitespace-nowrap">20</td>
          </tr>
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">Algebra - Unit 2 Quiz</td>
            <td className="p-2 whitespace-nowrap">Class 9A</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 10:30 AM</td>
            <td className="p-2 whitespace-nowrap">30 m</td>
            <td className="p-2 whitespace-nowrap">28</td>
          </tr>
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">English Grammar Check</td>
            <td className="p-2 whitespace-nowrap">Class 8B</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 4:00 PM</td>
            <td className="p-2 whitespace-nowrap">01 h, 20 m</td>
            <td className="p-2 whitespace-nowrap">20</td>
          </tr>
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">Algebra - Unit 2 Quiz</td>
            <td className="p-2 whitespace-nowrap">Class 9A</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 10:30 AM</td>
            <td className="p-2 whitespace-nowrap">30 m</td>
            <td className="p-2 whitespace-nowrap">28</td>
          </tr>
          <tr className="text-left font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3]">
            <td className="w-[30%] truncate p-2 whitespace-nowrap">English Grammar Check</td>
            <td className="p-2 whitespace-nowrap">Class 8B</td>
            <td className="p-2 whitespace-nowrap">Mar 12, 4:00 PM</td>
            <td className="p-2 whitespace-nowrap">01 h, 20 m</td>
            <td className="p-2 whitespace-nowrap">20</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

export default UpcomingTests;
