"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import CreateActionPlusIconSVG from "../svg/CreateActionPlusIconSVG";

const NameSection = () => {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user: User = JSON.parse(userData);
      if (user.full_name) setFullName(user.full_name);
    }
  }, []);
  return (
    <div className="flex justify-between items-center w-full min-h-[40px] mb-2 sm:mb-4">
      <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
        <p className="font-[500] text-[#232A25]">Welcome</p>
        <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
          {fullName || "John Doe"}
        </p>
      </div>

      <Link href="/tests/create" className="flex justify-end items-center gap-2 h-[40px]">
        <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#232A25] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px]">
          <CreateActionPlusIconSVG className="size-4 text-white" />
          <span className="capitalize mb-[2px]">Create Test</span>
        </button>
      </Link>
    </div>
  );
};

export default NameSection;
