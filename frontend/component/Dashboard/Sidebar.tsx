import { toggleSidebar } from "@/app/api/actions/toggleSidebar";
import sidebarList from "@/utils/sidebarList";
import { cookies } from "next/headers";
import Link from "next/link";
import SidebarLogout from "./SidebarLogout";

// hidden md:block h-screen bg-white overflow-y-auto min-w-[256px]

// fixed top-0 left-0 h-screen bg-white overflow-y-auto
// w-64 transform -translate-x-full z-1
// transition-transform duration-300
// md:translate-x-0 md:static md:block

const Sidebar = async ({ activeRoute }: { activeRoute: string }) => {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar")?.value || "closed";
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
              <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_291_8699)">
                  <path
                    d="M10.1818 20.3636C4.55857 20.3636 5.72205e-06 15.8051 5.72205e-06 10.1818C5.72205e-06 4.55856 4.55857 0 10.1818 0C15.8051 0 20.3636 4.55856 20.3636 10.1818C20.3636 15.8051 15.8051 20.3636 10.1818 20.3636Z"
                    fill="#49734F"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12.8168 3.32655C12.3673 2.93669 11.338 2.70056 10.0642 3.50277C6.16624 5.9578 2.78466 10.3739 1.64633 11.9646C1.35415 12.3729 0.786293 12.4671 0.377991 12.1749C-0.0303112 11.8827 -0.124445 11.3149 0.167738 10.9066C1.31866 9.29823 4.87366 4.62315 9.09529 1.9643C10.8739 0.844094 12.812 0.915657 14.0081 1.95302C14.6063 2.47183 14.9773 3.21214 14.9825 4.05486C14.9879 4.89141 14.6343 5.73628 13.9636 6.50312C11.7719 9.00897 8.86681 12.4189 7.64256 14.0896C7.28432 14.5785 7.44121 14.9901 7.70678 15.1888C7.94781 15.3692 8.57198 15.5516 9.44044 14.7553C9.79419 14.431 10.1592 14.0872 10.5327 13.7354C11.6748 12.6597 12.8968 11.5087 14.122 10.6073C15.3622 9.6947 16.758 9.47766 17.7872 10.1068C18.3007 10.4207 18.6604 10.9213 18.7859 11.5229C18.9103 12.1185 18.7938 12.7496 18.4823 13.3411C18.1297 14.0113 17.8246 14.4954 17.5469 14.9331L17.5235 14.97C17.2563 15.3911 17.0212 15.7614 16.769 16.2442C16.6217 16.5264 16.6256 16.8385 16.7219 17.0839C16.7697 17.2055 16.8323 17.2897 16.8851 17.3383C16.9107 17.3619 16.9309 17.3744 16.9436 17.3806C16.9478 17.3827 16.9511 17.3841 16.9537 17.385C16.9549 17.3856 16.9559 17.3859 16.9568 17.3862C16.9594 17.3869 16.9606 17.387 16.9609 17.3872C17.2004 17.4183 17.3921 17.3667 17.6496 17.1668C17.952 16.9321 18.2759 16.5449 18.7335 15.9462C19.0385 15.5473 19.609 15.4711 20.0079 15.7761C20.4068 16.081 20.4829 16.6516 20.178 17.0505C19.7382 17.6257 19.2812 18.202 18.7645 18.603C18.2029 19.039 17.5373 19.2956 16.7266 19.1901C15.8694 19.0788 15.2905 18.4131 15.0295 17.7486C14.7578 17.0566 14.7455 16.1913 15.1575 15.4023C15.4457 14.8508 15.7165 14.424 15.9795 14.0096C15.9903 13.9927 16.0009 13.9759 16.0116 13.959C16.2839 13.5298 16.5565 13.0966 16.8735 12.4943C17.0255 12.2054 17.0289 12.0037 17.0061 11.8942C16.9844 11.7907 16.9302 11.7139 16.8388 11.6581C16.6585 11.5478 16.0823 11.4222 15.1996 12.0717C14.0715 12.9018 12.9686 13.9402 11.8476 14.9956C11.4576 15.3629 11.0654 15.7322 10.6692 16.0954C9.31528 17.3369 7.71811 17.4679 6.61771 16.6448C5.54182 15.84 5.23712 14.2962 6.17597 13.0149C7.45501 11.2694 10.4143 7.79937 12.5951 5.3061C13.042 4.79509 13.1664 4.36436 13.1645 4.06636C13.1626 3.77454 13.0414 3.52134 12.8168 3.32655Z"
                    fill="#232A25"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_291_8699">
                    <rect width="20.3636" height="20.3636" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <p className="text-[20px] font-bold text-[#49734F] ml-2" style={{ fontFamily: "Public Sans" }}>
                Test<span className="text-[#232A25]">Taker</span>
              </p>
            </div>
            <form action={toggleSidebar}>
              <button type="submit">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M10 2V14M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
                    stroke="#232A25"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          </div>
          <nav className="flex flex-col gap-2">
            <p className="mt-4 px-4 pb-2 font-medium text-[13px] leading-[20px] tracking-[0.02em] text-[#747775] uppercase align-middle">
              Platform
            </p>
            {sidebarList
              .filter((element) => element.category === "Platform")
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
              .filter((element) => element.category === "System")
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
