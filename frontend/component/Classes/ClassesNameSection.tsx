"use client";

import { setActiveTab, setSearchInput } from "@/lib/features/classSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { classTabList } from "@/utils/classes/classTabList";
import React, { useEffect, useState } from "react";
import ClassSortSVG from "../svg/ClassSortSvg";
import NormalInput from "@/Ui/NormalInput";
import Link from "next/link";
import ShareClassModal from "./ShareClassModal";
import CreateActionPlusIconSVG from "../svg/CreateActionPlusIconSVG";

const ClassesNameSection = () => {
  const { activeTab, searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  return (
    <div className="mb-2 sm:mb-4 flex flex-col gap-2 sm:gap-4 min-h-[40px]">
      <div className="flex justify-between items-center w-full">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Classes</p>
        </div>

        <div className="flex justify-end items-center gap-2 h-[40px]">
          <Link href="/classes/create">
            <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#232A25] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px]">
              <CreateActionPlusIconSVG className="size-4 text-white" />
              <span className="capitalize mb-[2px]">Create Class</span>
            </button>
          </Link>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center w-full min-h-10 mb-2">
        <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
          {classTabList.map((tab) => (
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
        <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-0 ml-0 sm:ml-2 h-10">
          <NormalInput
            parentClassName="w-[300px] h-10"
            inputClassName="text-[12px] leading-[16px] font-[500] placeholder:text-[#989eaf]"
            value={searchInput}
            onChange={(e) => dispatch(setSearchInput(e.target.value))}
          />
          <div
            className="min-w-10 h-10 flex justify-center items-center bg-[#EFF0F3] rounded-md cursor-pointer"
            title="Sort"
          >
            <ClassSortSVG />
          </div>
        </div>
      </div>

      <ShareClassModal />
    </div>
  );
};

export default ClassesNameSection;
