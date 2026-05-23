import { toggleSidebar } from "@/app/api/actions/toggleSidebar";
import sidebarList from "@/utils/sidebarList";
import { cookies } from "next/headers";
import Link from "next/link";
import SidebarLogout from "./SidebarLogout";
import SidebarToggleIconSVG from "../svg/SidebarToggleIconSVG";
import TestTakerLogoMarkSVG from "../svg/TestTakerLogoMarkSVG";

// hidden md:block h-screen bg-white overflow-y-auto min-w-[256px]

// fixed top-0 left-0 h-screen bg-white overflow-y-auto
// w-64 transform -translate-x-full z-1
// transition-transform duration-300
// md:translate-x-0 md:static md:block

const Sidebar = async ({ activeRoute }: { activeRoute: string }) => {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar")?.value || "closed";
  const role = cookieStore.get("role")?.value as RoleUserType;

  return (
    <div
      id="sidebar"
      className={`
      fixed top-0 left-0 h-screen bg-white overflow-y-auto
      w-64 transform z-1
      transition-transform duration-1000
      ${sidebarState === "open" ? "translate-x-0" : "-translate-x-full"}
      md:translate-x-0 md:static md:block  
          `}
    >
      <aside className="w-[256px] h-full border-r border-gray-200 flex flex-col z-10 justify-between">
        <div className="px-4">
          <div className="w-full flex justify-between items-center h-[72px]">
            <div className="flex items-center justify-center">
              <TestTakerLogoMarkSVG width={21} />
              <p className="text-[20px] font-bold text-[#49734F] ml-2" style={{ fontFamily: "Public Sans" }}>
                Test<span className="text-[#232A25]">Taker</span>
              </p>
            </div>
            <form action={toggleSidebar}>
              <button type="submit" className="text-[#232A25]">
                <SidebarToggleIconSVG width={16} />
              </button>
            </form>
          </div>
          <nav className="flex flex-col gap-2">
            <p className="mt-4 px-4 pb-2 font-medium text-[13px] leading-[20px] tracking-[0.02em] text-[#747775] uppercase align-middle">
              Platform
            </p>
            {sidebarList
              .filter((element) => element.category === "Platform" && element.role.includes(role))
              .map((element) => {
                return (
                  <Link href={element.route} key={element.label} className="w-full">
                    <button
                      className={`${activeRoute === element.route ? "bg-[#49734F] text-white" : "bg-[white] text-[#232A25] hover:bg-[#49734F] hover:text-white"} rounded-lg px-4 py-2 flex items-center gap-2 font-medium w-full`}
                    >
                      {element.image}
                      {element.label}
                    </button>
                  </Link>
                );
              })}

            <p className="mt-4 px-4 pb-2 font-medium text-[13px] leading-[20px] tracking-[0.02em] text-[#747775] uppercase align-middle">
              System
            </p>
            {sidebarList
              .filter((element) => element.category === "System" && element.role.includes(role))
              .map((element) => {
                return (
                  <Link href={element.route} key={element.label} className="w-full">
                    <button
                      className={`${activeRoute === element.route ? "bg-[#49734F] text-white" : "bg-[white] text-[#232A25] hover:bg-[#49734F] hover:text-white"} rounded-lg px-4 py-2 flex items-center gap-2 font-medium w-full`}
                    >
                      {element.image}
                      {element.label}
                    </button>
                  </Link>
                );
              })}
          </nav>
        </div>
        <div className="w-full h-16 px-4 flex items-center border-t border-gray-200">
          <SidebarLogout />
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
