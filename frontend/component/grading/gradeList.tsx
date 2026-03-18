"use client";

import useGetAllClass from "@/hooks/api/class/useGetAllClass";
import Image from "next/image";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import ShareIconSVG from "../svg/ShareIconSVG";
import ThreeDotIconSVG from "../svg/ThreeDotIconSVG";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { setOpenAddStudentModal, setSearchInput, setOpenShareClassModal } from "@/lib/features/classSlice";
import Link from "next/link";
import { RotatingLines } from "react-loader-spinner";
import RemainingIconSVG from "../svg/RemainingIconSVG";
import DownloadIconSVG from "../svg/DownloadIconSVG";

const GradeList = () => {
  const { fetch, loading, classList, apiComplete } = useGetAllClass();
  const { searchInput } = useAppSelector((state) => state.class);
  const dispatch = useAppDispatch();

  const [filterdClassList, setFilterdClassList] = useState<Class[]>([]);

  useEffect(() => {
    if (classList.length > 0) {
      const filtered = classList.filter(
        (classItem) =>
          classItem.class_name.toLowerCase().includes(searchInput.toLowerCase()) ||
          classItem.description.toLowerCase().includes(searchInput.toLowerCase()),
      );
      setFilterdClassList(filtered);
    }
  }, [searchInput, classList]);

  useEffect(() => {
    dispatch(setSearchInput(""));
  }, [classList, loading]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-2 sm:gap-4">
      {filterdClassList.map((classItem, index) => {
        return <GradeCart />;
      })}
    </div>
  );
};

export default GradeList;

const GradeCart = () => {
  const testStatus = "Graded" as "Graded" | "GradedTests" | "NeedsGrading" | "Published";
  const statusColors = {
    Graded: "rgba(0,233,33,0.15)",
    GradedTests: "rgba(73,115,79,0.15)",
    Published: "rgba(73,115,79,0.15)",
    NeedsGrading: "#ED860025",
  };
  const statusTextColors = {
    Graded: "#49734F",
    GradedTests: "#49734F",
    Published: "rgba(73,115,79,0.15)",
    NeedsGrading: "#ED8600",
  };
  return (
    <div className="bg-white rounded-[8px] p-4">
      <div className="flex justify-between items-center">
        <p className="font-[500] text-[18px] leading-[18px] tracking-[-0.02em] text-[#232A25]">Test Name </p>
        <span
          style={{ background: statusColors[testStatus] }}
          className={`px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] text-[${statusTextColors[testStatus]}] border border-[${statusTextColors[testStatus]}] rounded-[27px] box-border`}
        >
          {testStatus}
        </span>
      </div>
      <div className="flex items-center py-4">
        <div className="flex-1">
          <p className="font-[400] text-[14px] leading-[18px] tracking-[-0.02em] text-[#747775]">Submissions</p>
          <p className="mt-2 font-[500] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">28/35</p>
        </div>
        <div className="flex-1">
          <p className="font-[400] text-[14px] leading-[18px] tracking-[-0.02em] text-[#747775]">Grading Done</p>
          <p className="mt-2 font-[500] text-[16px] leading-[16px] tracking-[-0.02em] text-[#232A25]">16/28</p>
        </div>
      </div>
      <div className="mt-2 mb-4 w-full h-[2px] bg-[#EFF0F3]"></div>
      <div className="flex justify-between items-center">
        {testStatus === "NeedsGrading" && (
          <div className="flex items-center gap-2">
            <RemainingIconSVG />
            <p className="font-[400] text-[14px] leading-[16px] uppercase text-[#232A25]">16 Hours Due</p>
          </div>
        )}
        {testStatus === "Graded" && (
          <div className="flex items-center gap-2">
            <button
              title="Share Tests"
              className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
              // onClick={() => dispatch(setOpenShareClassModal(classItem))}
            >
              <ShareIconSVG width={16} />
            </button>
            <button
              title="Share Class"
              className="w-8 h-8 flex justify-center items-center rounded-[8px] hover:bg-[#EFF0F3]"
              // onClick={() => dispatch(setOpenShareClassModal(classItem))}
            >
              <DownloadIconSVG width={16} />
            </button>
          </div>
        )}

        <button
          className="px-3 py-2 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] border rounded-lg transition-all duration-200"
          style={{
            color: statusTextColors[testStatus],
            borderColor: statusTextColors[testStatus],
            backgroundColor: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = statusTextColors[testStatus];
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = statusTextColors[testStatus];
          }}
        >
          {testStatus === "Graded"
            ? "Test Results"
            : testStatus === "NeedsGrading"
              ? "Continue Grading"
              : testStatus === "GradedTests"
                ? "Graded Test"
                : "Continue marking"}
        </button>
      </div>
    </div>
  );
};
