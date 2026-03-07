"use client";

import React, { useEffect, useState } from "react";

const NameSection = () => {
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user: User = JSON.parse(userData);
      if (user.first_name) setFullName(`${user.first_name} ${user.last_name}`);
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

      <div className="flex justify-end items-center gap-2 h-[40px]">
        <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#232A25] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="white"
            className="size-4 text-white"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>

          <span className="capitalize mb-[2px]">Create Test</span>
        </button>
      </div>
    </div>
  );
};

export default NameSection;
