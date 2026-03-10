import React from "react";

const LiveTest = () => (
  <div className="bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
    <div className="p-4 h-[55%]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Live test</div>
        <div className="flex gap-1 items-center">
          <button className="mr-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="w-1.5 h-1.5 bg-[#49734F] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-[#E5E5E5] cursor-pointer rounded-full"></div>
          <button className="ml-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#232A25"
              className="size-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-8 mb-2 font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">Test name</div>
      <div className="flex justify-between items-center">
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Class name</div>
        <div className="flex gap-1 items-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.93054 1.65234H8.06943" stroke="#49734F" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 8.06901L8.60417 6.46484" stroke="#49734F" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d="M2.72223 8.06977C2.72223 9.20431 3.17292 10.2924 3.97516 11.0946C4.7774 11.8969 5.86547 12.3475 7.00001 12.3475C8.13454 12.3475 9.22261 11.8969 10.0249 11.0946C10.8271 10.2924 11.2778 9.20431 11.2778 8.06977C11.2778 6.93523 10.8271 5.84716 10.0249 5.04492C9.22261 4.24269 8.13454 3.79199 7.00001 3.79199C5.86547 3.79199 4.7774 4.24269 3.97516 5.04492C3.17292 5.84716 2.72223 6.93523 2.72223 8.06977Z"
              stroke="#49734F"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">01:02</div>
        </div>
      </div>
    </div>

    <div className="flex h-[50%]">
      <div className="px-4 py-2 w-[50%] border-t border-r border-gray-200 h-full flex flex-col justify-evenly gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#49734F" />
          <path
            d="M17.1025 11.916C17.1995 11.8732 17.2818 11.8029 17.3392 11.7138C17.3966 11.6247 17.4266 11.5207 17.4255 11.4148C17.4244 11.3088 17.3923 11.2055 17.333 11.1176C17.2738 11.0297 17.1901 10.9611 17.0922 10.9204L12.4496 8.8057C12.3085 8.74132 12.1551 8.70801 12 8.70801C11.8449 8.70801 11.6916 8.74132 11.5504 8.8057L6.90835 10.9182C6.81191 10.9604 6.72988 11.0299 6.67227 11.118C6.61466 11.2061 6.58398 11.3091 6.58398 11.4144C6.58398 11.5196 6.61466 11.6226 6.67227 11.7108C6.72988 11.7989 6.81191 11.8683 6.90835 11.9105L11.5504 14.0274C11.6916 14.0917 11.8449 14.1251 12 14.1251C12.1551 14.1251 12.3085 14.0917 12.4496 14.0274L17.1025 11.916Z"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M17.4167 11.417V14.667" stroke="white" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M8.75 12.7705V14.6663C8.75 15.0973 9.09241 15.5106 9.7019 15.8154C10.3114 16.1201 11.138 16.2913 12 16.2913C12.862 16.2913 13.6886 16.1201 14.2981 15.8154C14.9076 15.5106 15.25 15.0973 15.25 14.6663V12.7705"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">24</div>
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Participants</div>
      </div>
      <div className="px-4 py-2 w-[50%] border-t border-gray-200 h-full flex flex-col justify-evenly gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#EBA533" />
          <path
            d="M8.0854 10.6692C8.00634 10.313 8.01848 9.94272 8.12069 9.59253C8.22291 9.24234 8.41189 8.92363 8.67011 8.66594C8.92834 8.40826 9.24744 8.21995 9.59784 8.11847C9.94825 8.01699 10.3186 8.00562 10.6746 8.08543C10.8705 7.77901 11.1404 7.52684 11.4594 7.35217C11.7784 7.17749 12.1363 7.08594 12.5 7.08594C12.8637 7.08594 13.2215 7.17749 13.5406 7.35217C13.8596 7.52684 14.1295 7.77901 14.3254 8.08543C14.6819 8.00527 15.0529 8.01659 15.4039 8.11832C15.7548 8.22004 16.0744 8.40888 16.3327 8.66726C16.5911 8.92564 16.78 9.24518 16.8817 9.59614C16.9834 9.9471 16.9947 10.3181 16.9146 10.6746C17.221 10.8705 17.4732 11.1404 17.6478 11.4594C17.8225 11.7785 17.9141 12.1363 17.9141 12.5C17.9141 12.8637 17.8225 13.2216 17.6478 13.5406C17.4732 13.8596 17.221 14.1295 16.9146 14.3254C16.9944 14.6814 16.983 15.0517 16.8815 15.4022C16.78 15.7526 16.5917 16.0717 16.334 16.3299C16.0764 16.5881 15.7577 16.7771 15.4075 16.8793C15.0573 16.9815 14.6869 16.9937 14.3308 16.9146C14.1351 17.2222 13.865 17.4754 13.5455 17.6509C13.2259 17.8263 12.8672 17.9183 12.5027 17.9183C12.1381 17.9183 11.7795 17.8263 11.4599 17.6509C11.1404 17.4754 10.8702 17.2222 10.6746 16.9146C10.3186 16.9944 9.94825 16.983 9.59784 16.8816C9.24744 16.7801 8.92834 16.5918 8.67011 16.3341C8.41189 16.0764 8.22291 15.7577 8.12069 15.4075C8.01848 15.0573 8.00634 14.687 8.0854 14.3308C7.77663 14.1354 7.52229 13.8651 7.34605 13.545C7.16981 13.2249 7.07739 12.8654 7.07739 12.5C7.07739 12.1346 7.16981 11.7751 7.34605 11.455C7.52229 11.1349 7.77663 10.8646 8.0854 10.6692Z"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.875 12.5003L11.9583 13.5837L14.125 11.417"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="font-[500] text-[20px] leading-[20px] tracking-[-0.02em] text-[#232A25]">24</div>
        <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775]">Participants</div>
      </div>
    </div>
  </div>
);

export default LiveTest;
