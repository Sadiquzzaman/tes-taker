import React from "react";

const TotalStudents = () => (
  <div className="bg-[#ffffff] p-4 rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="flex justify-between items-center">
      <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Total Students</div>
      <button className="flex items-center text-[#49734F]">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">Add Student </div>
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

    <div className="bg-white flex items-center justify-center bg-red w-full h-full">
      <div className="relative w-[193px] h-[162px] mx-auto">
        <div className="absolute left-[84px] top-[36px] w-[109px] h-[109px]">
          <div className="w-full h-full rounded-full bg-[#49734F] opacity-90"></div>

          <div className="absolute inset-0 rounded-full border-[2.1px] border-[#49734F]"></div>

          <div className="absolute inset-0 rounded-full border-[2.1px] border-[#49734F]"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
            <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">240</div>
            <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Total Sales</div>
          </div>
        </div>

        <div className="absolute left-[35px] top-[20px] w-[70px] h-[70px]">
          <div className="w-full h-full rounded-full bg-[#459A7D] opacity-80"></div>

          <div className="absolute inset-0 rounded-full border border-[#459A7D]"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
            <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">120</div>
            <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Orders</div>
          </div>
        </div>

        <div className="absolute left-[0px] bottom-[0px] w-[77px] h-[77px]">
          <div className="w-full h-full rounded-full bg-[#232A25] opacity-90"></div>

          <div className="absolute inset-0 rounded-full border-[1.5px] border-[#232A25]"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center gap-[4px]">
            <div className="text-[16px] font-medium leading-[16px] tracking-[-0.02em]">80</div>
            <div className="text-[12px] font-normal leading-[12px] tracking-[-0.02em]">Users</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default TotalStudents;
