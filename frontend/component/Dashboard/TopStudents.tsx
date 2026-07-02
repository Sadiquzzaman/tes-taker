"use client";

import NormalInput from "@/Ui/NormalInput";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ChevronDownFilledIconSVG from "../svg/ChevronDownFilledIconSVG";
import ChevronUpFilledIconSVG from "../svg/ChevronUpFilledIconSVG";
import RightArrowIconSVG from "../svg/RightArrowIconSVG";
import SortIconSVG from "../svg/SortIconSVG";
import { useDashboard } from "@/context/DashboardContext";
import DashboardEmptyState from "./DashboardEmptyState";
import DashboardWidgetSkeleton from "./DashboardWidgetSkeleton";
import { formatAvgScore } from "@/utils/Dashboard/format";

const TopStudents = () => {
  const { data, loading } = useDashboard();
  const classOptions = data?.top_students_by_class ?? [];

  const [open, setOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (classOptions.length > 0 && !selectedClassId) {
      setSelectedClassId(classOptions[0].class_id);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedClass = classOptions.find((item) => item.class_id === selectedClassId) ?? classOptions[0];
  const students = selectedClass?.students ?? [];

  useEffect(() => {
    setSearch("");
  }, [selectedClassId]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((student) => student.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aScore = a.avg_score_percent ?? 0;
        const bScore = b.avg_score_percent ?? 0;
        return sortOrder === "desc" ? bScore - aScore : aScore - bScore;
      });
  }, [students, search, sortOrder]);

  const rowPerTable = 10;
  const remainingStudents = Math.max(0, filteredStudents.length - rowPerTable);
  const hasStudentData = students.length > 0;

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Top Students</div>
        {classOptions.length > 0 && (
          <div ref={dropdownRef} className="relative inline-block">
            <button type="button" className="flex items-center text-[#747775]" onClick={() => setOpen(!open)}>
              <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] max-w-[120px] truncate">
                {selectedClass?.class_name ?? "Select class"}
              </div>
              {open ? (
                <ChevronUpFilledIconSVG className="size-4 ml-2 mt-[2px]" />
              ) : (
                <ChevronDownFilledIconSVG className="size-4 ml-2 mt-[2px]" />
              )}
            </button>
            {open && (
              <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-200 rounded shadow-lg z-50">
                {classOptions.map((classItem) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassId(classItem.class_id);
                      setOpen(false);
                    }}
                    key={classItem.class_id}
                    className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 truncate"
                  >
                    {classItem.class_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-4">
          <DashboardWidgetSkeleton lines={8} />
        </div>
      ) : !hasStudentData ? (
        <div className="mt-4 flex-1">
          <DashboardEmptyState
            title="No student data available"
            description="Top performing students will appear here once submissions are received."
          />
        </div>
      ) : (
        <>
          <div className="my-4 flex justify-between items-center">
            <NormalInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Student" />
            <div
              className="whitespace-nowrap ml-1 min-w-7 h-7 bg-[#EFF0F3] rounded-md flex items-center justify-center cursor-pointer"
              onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              title={sortOrder === "desc" ? "Sort: High to Low" : "Sort: Low to High"}
            >
              <SortIconSVG className={`size-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
            </div>
          </div>
          <table className="w-full table-fixed">
            <thead>
              <tr className="text-center font-[500] text-[12px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3]">
                <th className="text-left p-2 w-[50%] whitespace-nowrap">Student</th>
                <th className="p-2 whitespace-nowrap">Tests</th>
                <th className="p-2 whitespace-nowrap">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-[12px] text-[#747775]">
                    No students match your search.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(
                  (student, index) =>
                    index < rowPerTable && (
                      <tr
                        key={student.student_id}
                        className={`text-center font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] ${
                          filteredStudents.length === index + 1 ? "border-b-0" : "border-b"
                        } border-[#EFF0F3]`}
                      >
                        <td className="text-left w-[50%] truncate p-2 whitespace-nowrap">{student.name}</td>
                        <td className="p-2 whitespace-nowrap">{student.tests_taken}</td>
                        <td className="p-2 whitespace-nowrap">{formatAvgScore(student.avg_score_percent)}</td>
                      </tr>
                    ),
                )
              )}
            </tbody>
          </table>
          {remainingStudents > 0 && (
            <div className="mt-4 flex justify-center items-center text-[#49734F]">
              <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">
                View all <span className="font-[600]">{remainingStudents} Students</span>
              </div>
              <RightArrowIconSVG />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TopStudents;
