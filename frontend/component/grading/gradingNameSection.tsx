"use client";

import { setActiveTab, setSearchInput } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import ClassSortSVG from "../svg/ClassSortSvg";
import NormalInput from "@/Ui/NormalInput";
import { gradingTabList } from "@/utils/gradingTabList";
import FilterIconSVG from "../svg/FilterIconSVG";

const GradingNameSection = () => {
  const { activeTab, searchInput } = useAppSelector((state) => state.grade);
  const dispatch = useAppDispatch();

  return (
    <div className="mb-2 sm:mb-4 flex flex-col gap-2 sm:gap-4 min-h-[40px]">
      <div className="flex justify-between items-center w-full">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Grading</p>
        </div>
      </div>
      <div className="flex flex-col flex-wrap lg:flex-row justify-start lg:justify-between items-start lg:items-center w-full min-h-10 mb-2 gap-2">
        <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
          {gradingTabList.map((tab) => (
            <button
              key={tab.value}
              className={`px-2 sm:px-4 py-2 text-sm rounded leading-[20px] tracking-[-0.02em] ${
                activeTab.value === tab.value ? "font-[400] bg-white shadow text-[#232A25]" : "text-[#747775]"
              }`}
              onClick={() => dispatch(setActiveTab(tab))}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 lg:gap-4 h-10">
          <NormalInput
            parentClassName="w-[320px] h-10"
            inputClassName="text-[14px] leading-[14px] font-[400] placeholder:text-[#989eaf]"
            value={searchInput}
            placeholder="Search by Test, Subject or Class"
            onChange={(e) => dispatch(setSearchInput(e.target.value))}
          />
          <div
            className="min-w-10 h-10 flex justify-center items-center bg-[#EFF0F3] rounded-md cursor-pointer text-[#747775]"
            title="Filter"
          >
            <FilterIconSVG />
          </div>
          <div
            className="min-w-10 h-10 flex justify-center items-center bg-[#EFF0F3] rounded-md cursor-pointer text-[#747775]"
            title="Filter"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#747775"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
              />
            </svg>
          </div>
          <div
            className="min-w-10 h-10 flex justify-center items-center bg-[#EFF0F3] rounded-md cursor-pointer text-[#747775]"
            title="Sort"
          >
            <ClassSortSVG />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradingNameSection;
