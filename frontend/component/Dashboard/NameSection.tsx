"use client";

import React from "react";
import CreateTestActionButton from "@/component/Tests/CreateTestActionButton";
import { useNameSection } from "@/hooks/Dashboard/useNameSection";

const NameSection = () => {
  const { fullName } = useNameSection();

  return (
    <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
      <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
        <p className="font-[500] text-[#232A25]">Welcome</p>
        <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
          {fullName || "John Doe"}
        </p>
      </div>

      <div className="flex justify-end items-center gap-2 h-[40px]">
        <CreateTestActionButton />
      </div>
    </div>
  );
};

export default NameSection;
