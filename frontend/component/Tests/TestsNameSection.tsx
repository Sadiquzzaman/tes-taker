"use client";

import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import NormalInput from "@/Ui/NormalInput";
import { setActiveTab, setNewTestCreated, setSearchInput } from "@/lib/features/testSlice";
import { testsTabList } from "@/utils/testsTabList";
import FilterIconSVG from "../svg/FilterIconSVG";

const TestsNameSection = () => {
  const { activeTab, searchInput, newTestCreated } = useAppSelector((state) => state.test);
  const dispatch = useAppDispatch();

  return (
    <div className="mb-2 sm:mb-4 flex flex-col gap-2 sm:gap-4 min-h-[40px]">
      <div className="flex justify-between items-center w-full">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Tests</p>
        </div>

        <div className="flex justify-end items-center gap-2 h-[40px]">
          <Link href="/tests/create">
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
          </Link>
        </div>
      </div>
      <div className="flex flex-col lg:flex-row justify-start lg:justify-between items-start lg:items-center w-full min-h-10 mb-2">
        <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
          {testsTabList.map((tab) => (
            <button
              key={tab.value}
              className={`px-4 py-2 text-sm rounded leading-[20px] tracking-[-0.02em] ${
                activeTab.value === tab.value ? "font-[400] bg-white shadow text-[#232A25]" : "text-[#747775]"
              }`}
              onClick={() => dispatch(setActiveTab(tab))}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 lg:gap-4 mt-4 lg:mt-0 ml-0 lg:ml-2 h-10">
          <NormalInput
            parentClassName="max-w-[370px] w-full h-10"
            inputClassName="text-[14px] leading-[14px] font-[400] placeholder:text-[#989eaf]"
            value={searchInput}
            onChange={(e) => dispatch(setSearchInput(e.target.value))}
            placeholder="Search by Test, Subject or Class"
          />
          <div
            className="text-[#747775] min-w-10 h-10 flex justify-center items-center bg-[#EFF0F3] rounded-md cursor-pointer"
            title="Filter"
          >
            <FilterIconSVG />
          </div>
        </div>
      </div>
      {/* {newTestCreated && (
        <ShareTestModal
          open={newTestCreated !== null}
          setOpen={() => dispatch(setNewTestCreated(null))}
          testData={newTestCreated}
        />
      )} */}
    </div>
  );
};

export default TestsNameSection;
