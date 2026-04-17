"use client";

import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotatingLines } from "react-loader-spinner";
import ShareIconSVG from "../svg/ShareIconSVG";
import Link from "next/link";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";
// import ClassStudent from "./ClassStudent";
// import ClassTests from "./ClassTests";
// import ShareClassModal from "./ShareClassModal";
import { useAppDispatch } from "@/lib/hooks";
import { setOpenShareClassModal } from "@/lib/features/classSlice";
import useGetAllTests from "@/hooks/api/tests/useGetAllTests";
import ParticipantIconSVG from "../svg/ParticipantIconSVG";
import SortIconSVG from "../svg/SortIconSVG";
import NormalInput from "@/Ui/NormalInput";
import GradingModel from "./GradingModel";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

type Status = "Pending" | "Graded";

type Student = {
  name: string;
  email: string;
  submittedAt: string;
  status: Status;
  score: string | null;
};

const GradeDetailsComponent = ({ classId }: { classId: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  if (!classId) router.push("/classes");
  // const { loading, classData, fetch, apiComplete } = useGetAllClassById({ id: classId });
  // const { testList } = useGetAllTests({ classId });
  const [activeTab, setActiveTab] = useState(classTabList[0]);
  const [openModal, setOpenModal] = useState<string>("");

  // if (loading)
  //   return (
  //     <div className="w-full min-h-[calc(100vh-162px)] flex items-center justify-center">
  //       <RotatingLines
  //         visible={true}
  //         height="96"
  //         width="96"
  //         color="grey"
  //         strokeWidth="5"
  //         animationDuration="0.75"
  //         ariaLabel="rotating-lines-loading"
  //         wrapperStyle={{}}
  //         wrapperClass=""
  //       />
  //     </div>
  //   );

  // if (!apiComplete) return null;

  // if (classData === null) {
  //   return (
  //     <div className="w-full min-h-[calc(100vh-162px)] flex items-center justify-center">
  //       <div className="text-center">
  //         <p className="font-[600] text-[24px] leading-[32px] tracking-[-0.04em] text-[#232A25]">Class not found</p>
  //       </div>
  //     </div>
  //   );
  // }
  const classData = { class_name: "Grade Name" };

  const [searchStudentInput, setSearchStudentInput] = useState("");

  const testStatus: Status = "Pending";
  const statusColors = {
    Graded: "rgba(0,233,33,0.15)",
    Pending: "#ED860025",
  };
  const statusTextColors = {
    Graded: "#49734F",
    Pending: "#ED8600",
  };
  const statusButtonText = {
    Graded: "Student Result",
    Pending: "Start Grading",
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const totalPages = Math.ceil(studentList.length / itemsPerPage);
  const paginatedStudents = studentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <>
      <div className="sm:mt-2 mb-2 sm:mb-4 flex flex-col gap-2 sm:gap-4 min-h-[40px]">
        <Link href="/grading" className="w-max">
          <button className="border border-[#E5E5E5] rounded-[43px] flex items-center justify-center gap-2 w-[128px] sm:w-[158px] h-[32px] sm:h-[40px] font-[500] text-[#747775] font-[500] text-[12px] sm:text-[14px]">
            <LeftArrowIconSVG width={16} />
            <span className="capitalize mb-[2px]">Back to Grading</span>
          </button>
        </Link>

        <div className="flex justify-between items-center w-full">
          <p className="font-[600] text-[32px] leading-[32px] tracking-[-0.04em]">{classData?.class_name || ""}</p>
          <button
            disabled
            className="w-[108px] sm:w-[128px] h-[32px] sm:h-[40px] bg-[#49734F] disabled:bg-[#747775] rounded-xl font-[500] text-white font-medium text-[12px] sm:text-[14px]"
            // onClick={() => dispatch(setOpenShareClassModal(classData))}
          >
            Publish Result
          </button>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 p-4 rounded-[12px] bg-[#EFF0F3BF] flex gap-4">
            <ParticipantIconSVG />
            <div className="flex flex-col gap-4">
              <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775] whitespace-nowrap">
                Total students
              </p>
              <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">32</p>
            </div>
          </div>
          <div className="flex-1 p-4 rounded-[12px] bg-[#EFF0F3BF] flex gap-4">
            <ParticipantIconSVG />
            <div className="flex flex-col gap-4">
              <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775] whitespace-nowrap">
                Submissions
              </p>
              <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">32</p>
            </div>
          </div>
          <div className="flex-1 p-4 rounded-[12px] bg-[#EFF0F3BF] flex gap-4">
            <ParticipantIconSVG />
            <div className="flex flex-col gap-4">
              <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775] whitespace-nowrap">
                Pending
              </p>
              <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">24 </p>
            </div>
          </div>
          <div className="flex-1 p-4 rounded-[12px] bg-[#EFF0F3BF] flex gap-4">
            <ParticipantIconSVG />
            <div className="flex flex-col gap-4">
              <p className="font-[400] text-[12px] leading-[12px] tracking-[-0.02em] text-[#747775] whitespace-nowrap">
                Graded
              </p>
              <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">24</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-320px)]">
        <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
          <div className="flex justify-between items-center">
            <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">
              Student Submissions Table
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#EFF0F3] rounded-[6px] flex items-center justify-center">
                <SortIconSVG />
              </div>
            </div>
          </div>
          <NormalInput
            placeholder="Search Student"
            value={searchStudentInput}
            onChange={(e) => setSearchStudentInput(e.target.value)}
            parentClassName="w-full border-[#E5E5E5] rounded-[8px] h-[40px] my-8"
            inputClassName="text-[14px] leading-[125%] font-[400] placeholder:text-[#747775] px-2"
          />
          <table className="min-w-[400px] w-full table-fixed">
            <thead>
              <tr className="text-left font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3] h-10">
                <th className="p-2 whitespace-nowrap">Student</th>
                <th className="p-2 whitespace-nowrap">Email/Phone</th>
                <th className="p-2 whitespace-nowrap">Submitted At</th>
                <th className="p-2 whitespace-nowrap text-center">Status</th>
                <th className="p-2 whitespace-nowrap text-center">Score</th>
                <th className="p-2 whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student, index) => (
                <tr
                  key={index + (currentPage - 1) * itemsPerPage}
                  className="text-left font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3] h-10"
                >
                  <td className="p-2 whitespace-nowrap">{student.name}</td>
                  <td className="p-2 whitespace-nowrap">{student.email}</td>
                  <td className="p-2 whitespace-nowrap">{student.submittedAt}</td>
                  <td className="p-2 whitespace-nowrap text-center">
                    <span
                      style={{ background: statusColors[student.status] }}
                      className={`px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] text-[${statusTextColors[student.status]}] border border-[${statusTextColors[student.status]}] rounded-[27px] box-border`}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="p-2 whitespace-nowrap text-center">{student.score}</td>
                  <td className="p-2 whitespace-nowrap text-center">
                    <button
                      style={{ background: statusTextColors[student.status] }}
                      onClick={() => setOpenModal(student.status === "Graded" ? "result" : "edit")}
                      className="px-4 py-2 mx-auto flex justify-center items-center text-[#ffffff] rounded-[8px]"
                    >
                      {statusButtonText[student.status]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination Component */}
          <div className="flex flex-row justify-center items-center gap-6 w-full h-8 mt-8">
            <div className="flex flex-row justify-center items-center gap-2 w-[272px] h-8 opacity-80">
              {/* Previous Button */}
              <button
                className="flex flex-row justify-center items-center p-2 w-8 h-8 bg-white rounded-[6px] disabled:opacity-50"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="#232A25"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {/* Page Numbers */}
              {Array.from({ length: totalPages }).map((_, i) => {
                // Show first, last, current, and neighbors, with ellipsis
                if (i === 0 || i === totalPages - 1 || Math.abs(i + 1 - currentPage) <= 1) {
                  return (
                    <button
                      key={i}
                      className={`flex flex-row justify-center items-center px-2 py-2 w-8 h-8 border rounded-[6px] font-[400] text-[14px] leading-4 text-center tracking-[-0.02em] ${
                        currentPage === i + 1
                          ? "border-[#232A25] text-[#232A25] bg-white"
                          : "border-[#E5E5E5] text-[#747775] bg-white"
                      }`}
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  );
                } else if ((i === 1 && currentPage > 3) || (i === totalPages - 2 && currentPage < totalPages - 2)) {
                  return (
                    <span
                      key={i}
                      className="flex flex-row justify-center items-center px-2 py-2 w-8 h-8 bg-white rounded-[6px] font-[400] text-[14px] leading-4 text-center tracking-[-0.02em] text-[#747775]"
                    >
                      ...
                    </span>
                  );
                }
                return null;
              })}
              {/* Next Button */}
              <button
                className="flex flex-row justify-center items-center p-2 w-8 h-8 bg-white rounded-[6px] disabled:opacity-50"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="#232A25"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <GradingModel openModal={openModal} setOpenModal={setOpenModal} />
      </div>
    </>
  );
};
export default GradeDetailsComponent;

const studentList: Student[] = [
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Pending",
    score: null,
  },
  {
    name: "Anonymous",
    email: "Anonymous",
    submittedAt: "Mar 05, 2025 · 10:30 AM",
    status: "Graded",
    score: "18/20",
  },
];
