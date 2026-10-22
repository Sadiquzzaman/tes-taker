import sidebarList from "@/utils/sidebarList";
import React from "react";
import HeaderProfile from "./HeaderProfile";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { toggleSidebar } from "@/app/api/actions/toggleSidebar";
import BellIconSVG from "../svg/BellIconSVG";
import GlobeIconSVG from "../svg/GlobeIconSVG";

const Header = async ({ activeRoute, subText = "" }: { activeRoute: string; subText?: string }) => {
  const matched =
    sidebarList.find((item) => item.route === activeRoute) ||
    sidebarList.find((item) => activeRoute.startsWith(item.route) && item.route !== "/");

  return (
    <header className="w-full h-[72px] bg-white border-b border-gray-200 flex items-center px-4 sm:px-8 z-20">
      <form action={toggleSidebar} className="w-full flex-1 ">
        <button type="submit" className="flex items-center gap-2 cursor-pointer">
          {matched ? (
            <React.Fragment key={matched.route}>
              {matched.image}
              <span
                className={`${subText ? "font-[400] text-[#747775]" : "font-[500] text-[#232A25]"} text-[16px] leading-[20px]`}
              >
                {matched.label}
              </span>
              {subText && <span className="font-[500] text-[16px] text-[#232A25] leading-[20px]">/ {subText}</span>}
            </React.Fragment>
          ) : (
            <span className="font-[500] text-[16px] text-[#232A25] leading-[20px]">
              {subText || "Organization"}
            </span>
          )}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <WorkspaceSwitcher />
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
