"use client";

import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotatingLines } from "react-loader-spinner";
import ShareIconSVG from "../svg/ShareIconSVG";
import Link from "next/link";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

const ClassDetailsComponent = ({ classId }: { classId: string }) => {
  const router = useRouter();
  if (!classId) router.push("/classes");
  const { loading, classData } = useGetAllClassById({ id: classId });
  const [activeTab, setActiveTab] = useState(classTabList[0]);

  if (loading)
    return (
      <div className="w-full min-h-[calc(100vh-162px)] flex items-center justify-center">
        <RotatingLines
          visible={true}
          height="96"
          width="96"
          color="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="rotating-lines-loading"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    );

  return (
    <>
      <div className="sm:mt-2 mb-2 sm:mb-4 flex flex-col gap-2 sm:gap-4 min-h-[40px]">
        <div className="flex justify-between items-center w-full">
          <Link href="/classes" className="flex justify-end items-center gap-2 h-[40px]">
            <button className="border border-[#E5E5E5] rounded-[43px] flex items-center justify-center gap-2 w-[128px] sm:w-[158px] h-[32px] sm:h-[40px] font-[500] text-[#747775] font-[500] text-[12px] sm:text-[14px]">
              <LeftArrowIconSVG width={16} />

              <span className="capitalize mb-[2px]">Back to Classes</span>
            </button>
          </Link>

          <div className="flex justify-end items-center gap-2 h-[40px]">
            <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#232A25] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px]">
              <ShareIconSVG width={16} />

              <span className="capitalize mb-[2px]">Share Class</span>
            </button>
          </div>
        </div>
        <p className="py-2 font-[600] text-[32px] leading-[32px] tracking-[-0.04em]">{classData?.class_name || ""}</p>
        <div className="flex flex-col sm:flex-row justify-start sm:justify-between items-start sm:items-center w-full min-h-10 mb-2">
          <div className="flex w-fit rounded-md bg-gray-100 p-0.5">
            {classTabList.map((tab) => (
              <button
                key={tab.value}
                className={`px-4 py-2 text-sm rounded leading-[20px] tracking-[-0.02em] ${
                  activeTab.value === tab.value ? "font-[400] bg-white shadow text-[#232A25]" : "text-[#747775]"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-300px)]">
        <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full"></div>
      </div>
    </>
  );
};
export default ClassDetailsComponent;
