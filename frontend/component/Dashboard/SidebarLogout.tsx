"use client";

import React from "react";
import LogoutIconSVG from "../svg/LogoutIconSVG";
import { useSidebarLogout } from "@/hooks/Dashboard/useSidebarLogout";

const SidebarLogout = () => {
  const { handleLogout } = useSidebarLogout();

  return (
    <div className="w-full">
      <button
        className="bg-[white] text-[#232A25] hover:bg-[#49734F] hover:text-white rounded-lg px-4 py-2 flex items-center gap-2 font-medium w-full"
        onClick={handleLogout}
      >
        <LogoutIconSVG width={14} />
        Sign out
      </button>
    </div>
  );
};

export default SidebarLogout;
