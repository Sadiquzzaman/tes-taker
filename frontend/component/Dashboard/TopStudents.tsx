"use client";

import NormalInput from "@/Ui/NormalInput";
import React, { useRef, useState, useEffect } from "react";

const sampleClassList = [
  { name: "ABC Class", value: "abc" },
  { name: "Class 9A", value: "9a" },
  { name: "Class 8B", value: "8b" },
];

const sampleStudentList = [
  { name: "Alomgir Hossain", tests: 6, avgScore: "90%" },
  { name: "Motaleb Alom", tests: 7, avgScore: "80%" },
  { name: "Johir Hossain", tests: 5, avgScore: "85%" },
  { name: "Alomgir Ahmed", tests: 6, avgScore: "92%" },
  { name: "Irfan Hossain", tests: 5, avgScore: "91%" },
  { name: "Alomgir Hossain", tests: 6, avgScore: "90%" },
  { name: "Motaleb Alom", tests: 7, avgScore: "80%" },
  { name: "Johir Hossain", tests: 5, avgScore: "85%" },
  { name: "Alomgir Ahmed", tests: 6, avgScore: "92%" },
  { name: "Irfan Hossain", tests: 5, avgScore: "91%" },
  { name: "Alomgir Hossain", tests: 6, avgScore: "90%" },
  { name: "Motaleb Alom", tests: 7, avgScore: "80%" },
  { name: "Johir Hossain", tests: 5, avgScore: "85%" },
  { name: "Alomgir Ahmed", tests: 6, avgScore: "92%" },
  { name: "Irfan Hossain", tests: 5, avgScore: "91%" },
  { name: "Alomgir Hossain", tests: 6, avgScore: "90%" },
  { name: "Motaleb Alom", tests: 7, avgScore: "80%" },
  { name: "Johir Hossain", tests: 5, avgScore: "85%" },
  { name: "Alomgir Ahmed", tests: 6, avgScore: "92%" },
  { name: "Irfan Hossain", tests: 5, avgScore: "91%" },
];

const TopStudents = () => {
  const [open, setOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(sampleClassList[0]);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Reset search when class changes
  useEffect(() => {
    setSearch("");
  }, [selectedClass]);

  // Filter and sort students
  const filteredStudents = sampleStudentList
    .filter((student) => {
      return student.name.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const aScore = parseFloat(a.avgScore);
      const bScore = parseFloat(b.avgScore);
      if (sortOrder === "desc") {
        return bScore - aScore;
      } else {
        return aScore - bScore;
      }
    });
  const rowPerTable = 10;
  const remainingStudents = filteredStudents.length - rowPerTable;

  return (
    <div className="p-4 bg-[#ffffff] rounded-[12px] flex flex-col text-white w-full h-full min-h-[240px]">
      <div className="flex justify-between items-center">
        <div className="font-[500] text-[14px] leading-[16px] text-[#232A25] tracking-[-0.02em]">Top Students</div>
        <div ref={dropdownRef} className="relative inline-block">
          <button className="flex items-center text-[#747775]" onClick={() => setOpen(!open)}>
            <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">{selectedClass.name}</div>
            {open ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4 ml-2 mt-[2px]"
              >
                <path
                  fillRule="evenodd"
                  d="M11.47 7.72a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 1 1-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 0 1-1.06-1.06l7.5-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4 ml-2 mt-[2px]"
              >
                <path
                  fillRule="evenodd"
                  d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-40 bg-white border border-gray-200 rounded shadow-lg z-50">
              {sampleClassList.map((classItem) => (
                <button
                  onClick={() => {
                    setSelectedClass(classItem);
                    setOpen(false);
                  }}
                  key={classItem.value}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  {classItem.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="my-4 flex justify-between items-center">
        <NormalInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Student" />
        <div
          className="whitespace-nowrap ml-1 min-w-7 h-7 bg-[#EFF0F3] rounded-md flex items-center justify-center cursor-pointer"
          onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
          title={sortOrder === "desc" ? "Sort: High to Low" : "Sort: Low to High"}
        >
          {sortOrder === "desc" ? (
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
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="#747775"
              className="size-4 rotate-180"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
              />
            </svg>
          )}
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
          {filteredStudents.map(
            (student, index) =>
              index < rowPerTable && (
                <tr
                  key={index}
                  className={`text-center font-[400] text-[12px] leading-[16px] tracking-[-0.02em] text-[#747775] ${filteredStudents.length === index + 1 ? "border-b-0" : "border-b"} border-[#EFF0F3]`}
                >
                  <td className="text-left w-[50%] truncate p-2 whitespace-nowrap">{student.name}</td>
                  <td className="p-2 whitespace-nowrap">{student.tests}</td>
                  <td className="p-2 whitespace-nowrap">{student.avgScore}</td>
                </tr>
              ),
          )}
        </tbody>
      </table>
      {remainingStudents > 0 && (
        <div className="mt-4 flex justify-center items-center text-[#49734F]">
          <div className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em]">
            View all <span className="font-[600]">{remainingStudents} Students</span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-4 ml-1 mt-[2px]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default TopStudents;
