import React from "react";

const NeedsMarking = () => (
  <div className="bg-[#49734F] rounded-[12px] p-4 flex flex-col justify-between text-white w-full h-full min-h-[150px]">
    <div>
      <div className="font-[500] text-[14px] leading-[16px] text-white tracking-[-0.02em]">Needs marking</div>
      <div className="font-[400] text-[16px] leading-[100%] text-white tracking-[-0.02em] mt-3">
        <span className="font-[600]">15 submissions</span> waiting for review. Finish marking to publish results.
      </div>
    </div>{" "}
    <button className="bg-white text-[#49734F] flex items-center gap-2 rounded-[8px] px-4 py-2 w-fit">
      <p className="font-[500] text-[14px] leading-[16px] tracking-[-0.02em] mb-[2px]">Go to Marking</p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        className="size-4 mt-[2px]"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
    </button>
  </div>
);

export default NeedsMarking;
