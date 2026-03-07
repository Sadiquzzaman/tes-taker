import sidebarList from "@/utils/sidebarList";
import React from "react";
import HeaderProfile from "./HeaderProfile";
import { toggleSidebar } from "@/app/api/actions/toggleSidebar";

const Header = async ({ activeRoute }: { activeRoute: string }) => {
  return (
    <header className="w-full h-[72px] bg-white border-b border-gray-200 flex items-center px-4 sm:px-8 z-20">
      <form action={toggleSidebar} className="w-full flex-1 ">
        <button type="submit" className="flex items-center gap-2 cursor-pointer">
          {sidebarList
            .filter((item) => item.route === activeRoute)
            .map((item) => (
              <React.Fragment key={item.route}>
                {item.image}
                <span className="font-medium text-[16px] text-[#232A25] leading-[20px]">{item.label}</span>
              </React.Fragment>
            ))}
        </button>
      </form>

      <div className="flex items-center gap-4">
        <span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.3002 5.53301C4.3002 4.55171 4.69002 3.6106 5.3839 2.91671C6.07778 2.22283 7.01889 1.83301 8.0002 1.83301C8.9815 1.83301 9.92261 2.22283 10.6165 2.91671C11.3104 3.6106 11.7002 4.55171 11.7002 5.53301C11.7002 9.84967 13.5502 11.083 13.5502 11.083H2.4502C2.4502 11.083 4.3002 9.84967 4.3002 5.53301Z"
              stroke="#232A25"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.95215 13.5498C7.05537 13.7375 7.20711 13.8941 7.39152 14.0032C7.57593 14.1122 7.78624 14.1698 8.00048 14.1698C8.21472 14.1698 8.42504 14.1122 8.60945 14.0032C8.79386 13.8941 8.9456 13.7375 9.04882 13.5498"
              stroke="#232A25"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1.83301 7.99967C1.83301 8.80949 1.99251 9.61138 2.30242 10.3596C2.61232 11.1077 3.06655 11.7875 3.63918 12.3602C4.21181 12.9328 4.89162 13.387 5.63979 13.6969C6.38797 14.0068 7.18986 14.1663 7.99967 14.1663C8.80949 14.1663 9.61138 14.0068 10.3596 13.6969C11.1077 13.387 11.7875 12.9328 12.3602 12.3602C12.9328 11.7875 13.387 11.1077 13.6969 10.3596C14.0068 9.61138 14.1663 8.80949 14.1663 7.99967C14.1663 7.18986 14.0068 6.38797 13.6969 5.63979C13.387 4.89162 12.9328 4.21181 12.3602 3.63918C11.7875 3.06655 11.1077 2.61232 10.3596 2.30242C9.61138 1.99251 8.80949 1.83301 7.99967 1.83301C7.18986 1.83301 6.38797 1.99251 5.63979 2.30242C4.89162 2.61232 4.21181 3.06655 3.63918 3.63918C3.06655 4.21181 2.61232 4.89162 2.30242 5.63979C1.99251 6.38797 1.83301 7.18986 1.83301 7.99967Z"
              stroke="#232A25"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7.99999 1.83301C6.41654 3.49564 5.53333 5.70366 5.53333 7.99967C5.53333 10.2957 6.41654 12.5037 7.99999 14.1663C9.58345 12.5037 10.4667 10.2957 10.4667 7.99967C10.4667 5.70366 9.58345 3.49564 7.99999 1.83301Z"
              stroke="#232A25"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M1.83301 8H14.1663"
              stroke="#232A25"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <HeaderProfile />
      </div>
    </header>
  );
};

export default Header;
