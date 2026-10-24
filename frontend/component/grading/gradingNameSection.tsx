"use client";

import NormalInput from "@/Ui/NormalInput";
import { gradingTabList } from "@/utils/gradingTabList";
import { setActiveTab, setSearchInput } from "@/lib/features/gradingSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import ClassSortSVG from "../svg/ClassSortSvg";
import FilterIconSVG from "../svg/FilterIconSVG";
import SortIconSVG from "../svg/SortIconSVG";

const GradingNameSection = () => {
  const { activeTab, searchInput } = useAppSelector((state) => state.grade);
  const dispatch = useAppDispatch();

  return (
    <div className="mb-2 flex min-h-[40px] flex-col gap-2 sm:mb-4 sm:gap-4">
      <div className="flex w-full items-center justify-between">
        <div className="mr-4 flex flex-wrap items-center gap-0 text-title-sm tracking-tight md:text-display">
          <p className="font-medium text-ink">Grading</p>
        </div>
      </div>

      <div className="mb-2 flex min-h-10 w-full flex-col items-start justify-start gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-fit rounded-md bg-canvas p-0.5">
          {gradingTabList.map((tab) => (
            <button
              key={tab.value}
              className={`rounded px-2 py-2 text-sm sm:px-4 ${
                activeTab.value === tab.value ? "bg-surface font-normal text-ink shadow" : "text-ink-muted"
              }`}
              onClick={() => dispatch(setActiveTab(tab))}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="flex h-10 gap-2 lg:gap-4">
          <NormalInput
            parentClassName="h-10 w-[320px]"
            inputClassName="text-body-sm font-normal placeholder:text-ink-muted"
            value={searchInput}
            placeholder="Search by Test, Subject or Class"
            onChange={(event) => dispatch(setSearchInput(event.target.value))}
          />
          <div
            className="flex min-w-10 cursor-pointer items-center justify-center rounded-md bg-canvas text-ink-muted"
            title="Filter"
          >
            <FilterIconSVG />
          </div>
          <div
            className="flex min-w-10 cursor-pointer items-center justify-center rounded-md bg-canvas text-ink-muted"
            title="Filter"
          >
            <SortIconSVG />
          </div>
          <div
            className="flex min-w-10 cursor-pointer items-center justify-center rounded-md bg-canvas text-ink-muted"
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
