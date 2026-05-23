"use client";

import Image from "next/image";
import { useHeaderProfile } from "@/hooks/Dashboard/useHeaderProfile";

const HeaderProfile = () => {
  const { open, setOpen, user, dropdownRef } = useHeaderProfile();

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <span className="hidden sm:block font-medium text-[#232A25] text-[16px] leading-[20px]">
          {user?.full_name || ""}
        </span>
        <span className="w-8 h-8 rounded-full bg-gray-300 relative">
          <Image src="/assets/image/user.png" alt="User Avatar" fill className="object-cover rounded-full" />
        </span>
      </div>
    </div>
  );
};

export default HeaderProfile;
