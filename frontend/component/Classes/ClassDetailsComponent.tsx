"use client";

import useGetAllClassById from "@/hooks/api/class/useGetAllClassById";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RotatingLines } from "react-loader-spinner";
import ShareIconSVG from "../svg/ShareIconSVG";
import Link from "next/link";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import SortIconSVG from "../svg/SortIconSVG";
import NormalInput from "@/Ui/NormalInput";
import TickSignIconSVG from "../svg/TickSignIconSVG";
import CrossIconSVG from "../svg/CrossIconSVG";
import ThreeDotIconSVG from "../svg/ThreeDotIconSVG";
import EyeIconSVG from "../svg/EyeIconSVG";
import useRemoveStudentFromClass from "@/hooks/api/class/useRemoveStudentFromClass";
import useApproveStudent from "@/hooks/api/class/useApproveStudent";

export const classTabList = [
  { name: "Student", value: "student" },
  { name: "Tests", value: "tests" },
];

const ClassDetailsComponent = ({ classId }: { classId: string }) => {
  const router = useRouter();
  if (!classId) router.push("/classes");
  const { loading, classData, fetch } = useGetAllClassById({ id: classId });
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
        <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
          {activeTab.value === "student" && (
            <ClassesStudent classId={classId} student={classData?.classStudents || []} fetch={fetch} />
          )}
          {activeTab.value === "tests" && <ClassesTests />}
        </div>
      </div>
    </>
  );
};
export default ClassDetailsComponent;

const ClassesStudent = ({
  student,
  classId,
  fetch,
}: {
  student: ClassStudent[];
  classId: string;
  fetch: () => void;
}) => {
  const [searchStudentInput, setSearchStudentInput] = useState("");
  const [filteredStudent, setFilteredStudent] = useState<{ pending: ClassStudent[]; active: ClassStudent[] }>({
    pending: [],
    active: [],
  });
  useEffect(() => {
    if (student.length > 0) {
      setFilteredStudent({
        pending: student.filter((item) => item.status === "PENDING"),
        active: student.filter((item) => item.status !== "PENDING").sort((a, b) => (a.status === "JOINED" ? 0 : 1)),
      });
    } else {
      setFilteredStudent({
        pending: [],
        active: [],
      });
    }
  }, [student, searchStudentInput]);

  const [removeStudentFromClass] = useRemoveStudentFromClass({ classId });
  const [approveStudent] = useApproveStudent({ classId });

  const handleRemoveStudent = (studentId: string) => {
    removeStudentFromClass({ student_ids: [studentId] }).then((res) => {
      if (res?.statusCode === 200) fetch();
    });
  };

  const handleApproveStudent = (studentId: string) => {
    approveStudent(studentId).then((res) => {
      if (res?.statusCode === 201) fetch();
    });
  };

  console.log({ filteredStudent });
  return (
    <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
      <div className="flex justify-between items-center">
        <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">Students</p>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-300 rounded-[6px] flex items-center justify-center">
            <SortIconSVG />
          </div>
          <button className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] bg-[#49734F] rounded-[8px] font-[500] text-white font-medium text-[12px] sm:text-[14px]">
            <HumanAddIconSVG width={16} />
            <span className="capitalize mb-[2px]">Add Student</span>
          </button>
        </div>
      </div>

      <NormalInput
        placeholder="Search Student"
        value={searchStudentInput}
        onChange={(e) => setSearchStudentInput(e.target.value)}
        parentClassName="w-full border-[#E5E5E5] rounded-[8px] h-[40px] my-4"
        inputClassName="text-[14px] leading-[125%] font-[400] placeholder:text-[#747775] px-2"
      />

      <p className="font-[500] text-[18px] leading-[18px] tracking-[-0.02em] text-[#49734F] my-4">
        Pending approvals ({filteredStudent.pending.length})
      </p>

      {filteredStudent.pending.length > 0 && (
        <table className="my-4 min-w-[400px] w-full table-fixed">
          <thead>
            <tr className="text-left font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3] h-10">
              <th className="p-2 w-[30%] whitespace-nowrap">Student</th>
              <th className="p-2 whitespace-nowrap">Email/Phone</th>
              <th className="p-2 w-[105px] whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudent.pending.map((item) => (
              <tr
                key={item.id}
                className="text-left font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3] h-10"
              >
                <td className="p-2 whitespace-nowrap">{item.student?.full_name || "N/A"}</td>
                <td className="p-2 whitespace-nowrap">{item.student?.email || item.student?.phone || "N/A"}</td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveStudent(item.student_id)}
                      className="w-6 h-6 flex justify-center items-center text-[#49734F]"
                    >
                      <TickSignIconSVG />
                    </button>
                    <button
                      onClick={() => handleRemoveStudent(item.student_id)}
                      className="w-6 h-6 flex justify-center items-center text-[#D24B44]"
                    >
                      <CrossIconSVG />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="font-[500] text-[18px] leading-[18px] tracking-[-0.02em] text-[#49734F] my-4">
        Active Students ({filteredStudent.active.length})
      </p>

      {filteredStudent.active?.length && (
        <table className="my-4 min-w-[400px] w-full table-fixed">
          <thead>
            <tr className="text-left font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3] h-10">
              <th className="p-2 w-[30%] whitespace-nowrap">Student</th>
              <th className="p-2 whitespace-nowrap">Email/Phone</th>
              <th className="p-2 w-[105px] whitespace-nowrap">Status</th>
              <th className="p-2 w-[105px] whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudent.active.map((item) => (
              <tr
                key={item.id}
                className="text-left font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3] h-10"
              >
                <td className="p-2 whitespace-nowrap">{item.student?.full_name || "N/A"}</td>
                <td className="p-2 whitespace-nowrap">
                  {item.student?.email || item.student?.phone || item.invited_email || item.invited_phone || "N/A"}
                </td>
                <td className="p-2 whitespace-nowrap">
                  {item.status === "JOINED" ? <JoinedBadge /> : <InvitedBadge />}
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button className="w-6 h-6 flex justify-center items-center text-[#747775]">
                      <EyeIconSVG />
                    </button>
                    <button className="w-6 h-6 flex justify-center items-center text-[#747775]">
                      <ThreeDotIconSVG width={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ClassesTests = () => {
  return <div>Tests</div>;
};

const InvitedBadge = () => {
  return (
    <div
      className="flex items-center justify-center px-2 py-1 gap-2 w-14 h-6 
bg-[rgba(255,145,0,0.1)] border border-[rgba(255,145,0,0.1)] 
rounded-[27px] box-border"
    >
      <span
        className="text-[#ED8600] text-[12px] leading-[12px] font-medium 
  tracking-[-0.02em] font-['Instrument_Sans'] flex items-center"
      >
        Invited
      </span>
    </div>
  );
};

const JoinedBadge = () => {
  return (
    <div
      className="flex items-center justify-center px-2 py-1 gap-2 w-14 h-6
bg-[rgba(0,233,33,0.15)] border-[0.5px] border-[rgba(0,233,33,0.15)]
rounded-[27px] box-border"
    >
      <span
        className="text-[#49734F] text-[12px] leading-[12px] font-medium
  tracking-[-0.02em] font-['Instrument_Sans'] flex items-center"
      >
        Joined
      </span>
    </div>
  );
};
