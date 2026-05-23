import sidebarList from "@/utils/sidebarList";
import React from "react";
import HeaderProfile from "./HeaderProfile";
import { toggleSidebar } from "@/app/api/actions/toggleSidebar";
import BellIconSVG from "../svg/BellIconSVG";
import GlobeIconSVG from "../svg/GlobeIconSVG";

const Header = async ({ activeRoute, subText = "" }: { activeRoute: string; subText?: string }) => {
  return (
    <header className="w-full h-[72px] bg-white border-b border-gray-200 flex items-center px-4 sm:px-8 z-20">
      <form action={toggleSidebar} className="w-full flex-1 ">
        <button type="submit" className="flex items-center gap-2 cursor-pointer">
          {sidebarList
            .filter((item) => item.route === activeRoute)
            .map((item) => (
              <React.Fragment key={item.route}>
                {item.image}
                <span
                  className={`${subText ? "font-[400] text-[#747775]" : "font-[500] text-[#232A25]"} text-[16px] leading-[20px]`}
                >
                  {item.label}
                </span>
                {subText && <span className="font-[500] text-[16px] text-[#232A25] leading-[20px]">/ {subText}</span>}
              </React.Fragment>
            ))}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <span className="text-[#232A25]">
          <BellIconSVG width={16} />
        </span>
        <span className="text-[#232A25]">
          <GlobeIconSVG width={16} />
        </span>
        <HeaderProfile />
      </div>
    </header>
  );
};

export default Header;
