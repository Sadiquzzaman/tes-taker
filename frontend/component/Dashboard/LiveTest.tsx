import React from "react";
import ParticipantIconSVG from "../svg/ParticipantIconSVG";
import SubmittedIconSVG from "../svg/SubmittedIconSVG";
import ChevronLeftIconSVG from "../svg/ChevronLeftIconSVG";
import ChevronRightIconSVG from "../svg/ChevronRightIconSVG";
import LiveTestTimerIconSVG from "../svg/LiveTestTimerIconSVG";

const LiveTest = () => (
  <div className="bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="p-4 h-[55%]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Live test</div>
        <div className="flex gap-1 items-center">
          <button className="mr-2 text-[#232A25]">
            <ChevronLeftIconSVG className="size-4" />
          </button>
          <div className="w-1.5 h-1.5 bg-[#49734F] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <button className="ml-2 text-[#232A25]">
            <ChevronRightIconSVG className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-8 mb-2 font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">Test name</div>
      <div className="flex justify-between items-center">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Class name</div>
        <div className="flex gap-1 items-center">
          <div className="text-[#49734F]">
            <LiveTestTimerIconSVG width={14} />
          </div>
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
