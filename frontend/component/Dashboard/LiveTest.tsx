import React from "react";
import ParticipantIconSVG from "../svg/ParticipantIconSVG";
import SubmittedIconSVG from "../svg/SubmittedIconSVG";

const LiveTest = () => (
  <div className="bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="p-4 h-[55%]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Live test</div>
        <div className="flex gap-1 items-center">
          <button className="mr-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-1.5 h-1.5 bg-[#49734F] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <button className="ml-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-8 mb-2 font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">Test name</div>
      <div className="flex justify-between items-center">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Class name</div>
        <div className="flex gap-1 items-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.93054 1.65234H8.06943" stroke="#49734F" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 8.06901L8.60417 6.46484" stroke="#49734F" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M2.72223 8.06977C2.72223 9.20431 3.17292 10.2924 3.97516 11.0946C4.7774 11.8969 5.86547 12.3475 7.00001 12.3475C8.13454 12.3475 9.22261 11.8969 10.0249 11.0946C10.8271 10.2924 11.2778 9.20431 11.2778 8.06977C11.2778 6.93523 10.8271 5.84716 10.0249 5.04492C9.22261 4.24269 8.13454 3.79199 7.00001 3.79199C5.86547 3.79199 4.7774 4.24269 3.97516 5.04492C3.17292 5.84716 2.72223 6.93523 2.72223 8.06977Z"
              stroke="#49734F"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">01:02</div>
        </div>
      </div>
    </div>

    <div className="flex h-[50%]">
      <div className="px-4 py-2 w-[50%] border-t border-r border-gray-200 h-full flex flex-col justify-evenly gap-2">
        <ParticipantIconSVG />
        <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">24</div>
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Participants</div>
      </div>
      <div className="px-4 py-2 w-[50%] border-t border-gray-200 h-full flex flex-col justify-evenly gap-2">
        <SubmittedIconSVG />
        <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">20</div>
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Submitted</div>
      </div>
    </div>
  </div>
);

export default LiveTest;
