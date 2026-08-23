import { useEffect, useRef, useState } from "react";
import useClassStudent from "@/hooks/classes/useClassStudent";
import dayjs from "dayjs";
import SortIconSVG from "../svg/SortIconSVG";
import HumanAddIconSVG from "../svg/HumanAddIconSvg";
import NormalInput from "@/Ui/NormalInput";
import TickSignIconSVG from "../svg/TickSignIconSVG";
import CrossIconSVG from "../svg/CrossIconSVG";
import EyeIconSVG from "../svg/EyeIconSVG";
import ThreeDotIconSVG from "../svg/ThreeDotIconSVG";
import AddStudentModal from "./AddStudentModal";
import { setOpenAddStudentModal } from "@/lib/features/classSlice";
import { useAppDispatch } from "@/lib/hooks";
import { InvitedBadge, JoinedBadge } from "./StudentBadges";
import { getClassStudentContact, getClassStudentDisplayName } from "@/utils/classes/classStudentDisplay";

const ClassStudent = ({
  student,
  classId,
  fetch,
  role,
}: {
  student: ClassDetailsStudentItem[];
  classId: string;
  fetch: () => void;
  role: RoleUserType | undefined;
}) => {
  const dispatch = useAppDispatch();
  const isTeacher = role === "TEACHER";
  const { searchStudentInput, setSearchStudentInput, filteredStudent, handleRemoveStudent, handleApproveStudent } =
    useClassStudent({ student, classId, fetch, role });
  const [viewingStudent, setViewingStudent] = useState<ClassStudent | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
      <div className="flex justify-between items-center">
        <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">Students</p>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-300 rounded-[6px] flex items-center justify-center">
              <SortIconSVG />
            </div>
            <button
              onClick={() => dispatch(setOpenAddStudentModal({ id: classId }))}
              className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] bg-[#49734F] rounded-[8px] font-[500] text-white font-medium text-[12px] sm:text-[14px]"
            >
              <HumanAddIconSVG width={16} />
              <span className="capitalize mb-[2px]">Add Student</span>
            </button>
          </div>
        )}
      </div>

      <NormalInput
        placeholder="Search Student"
        value={searchStudentInput}
        onChange={(e) => setSearchStudentInput(e.target.value)}
        parentClassName="w-full border-[#E5E5E5] rounded-[8px] h-[40px] my-4"
        inputClassName="text-[14px] leading-[125%] font-[400] placeholder:text-[#747775] px-2"
      />

      {isTeacher && (
        <>
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
                    <td className="p-2 whitespace-nowrap">{getClassStudentDisplayName(item)}</td>
                    <td className="p-2 whitespace-nowrap">{getClassStudentContact(item)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveStudent(item.student_id)}
                          className="w-6 h-6 flex justify-center items-center text-[#49734F]"
                        >
                          <TickSignIconSVG />
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(item)}
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
        </>
      )}

      <p className="font-[500] text-[18px] leading-[18px] tracking-[-0.02em] text-[#49734F] my-4">
        Active Students ({isTeacher ? filteredStudent.activeStudents.length : filteredStudent.classmates.length})
      </p>

      {isTeacher && filteredStudent.activeStudents.length > 0 && (
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
            {filteredStudent.activeStudents.map((item) => (
              <tr
                key={item.id}
                className="text-left font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775] border-b border-[#EFF0F3] h-10"
              >
                <td className="p-2 whitespace-nowrap">{getClassStudentDisplayName(item)}</td>
                <td className="p-2 whitespace-nowrap">{getClassStudentContact(item)}</td>
                <td className="p-2 whitespace-nowrap">
                  {item.status === "JOINED" ? <JoinedBadge /> : <InvitedBadge />}
                </td>
                <td className="p-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="View student"
                      onClick={() => setViewingStudent(item)}
                      className="w-6 h-6 flex justify-center items-center text-[#747775] hover:text-[#232A25]"
                    >
                      <EyeIconSVG />
                    </button>
                    <div
                      className="relative"
                      ref={openActionId === item.id ? actionMenuRef : undefined}
                    >
                      <button
                        type="button"
                        title="Student actions"
                        onClick={() => setOpenActionId((current) => (current === item.id ? null : item.id))}
                        className="w-6 h-6 flex justify-center items-center text-[#747775] hover:text-[#232A25]"
                      >
                        <ThreeDotIconSVG width={16} />
                      </button>
                      {openActionId === item.id && (
                        <div className="absolute right-0 z-20 mt-1 w-[160px] rounded-[8px] border border-[#EFF0F3] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-[13px] text-[#232A25] hover:bg-[#EFF0F3]"
                            onClick={() => {
                              setOpenActionId(null);
                              setViewingStudent(item);
                            }}
                          >
                            View details
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-[13px] text-[#D24B44] hover:bg-[#FDECEC]"
                            onClick={() => {
                              setOpenActionId(null);
                              handleRemoveStudent(item);
                            }}
                          >
                            Remove from class
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isTeacher && filteredStudent.classmates.length > 0 && (
        <table className="my-4 min-w-[400px] w-full table-fixed">
          <thead>
            <tr className="text-left font-[500] text-[14px] leading-[16px] tracking-[-0.02em] text-[#232A25] border-b border-[#EFF0F3] h-10">
              <th className="py-2 pr-2 whitespace-nowrap">Student</th>
              <th className="py-2 pl-2 whitespace-nowrap text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudent.classmates.map((item, index) => (
              <tr
                key={`${item.name}-${item.joined_at}-${index}`}
                className="font-[400] text-[14px] leading-[16px] tracking-[-0.02em] text-[#747775] border-t border-[#EFF0F3] h-10"
              >
                <td className="py-2 pr-2">
                  <p className="truncate">{item.name}</p>
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap">
                  Joined since {dayjs(item.joined_at).format("MMM D, YYYY")}.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {viewingStudent && (
        <div
          className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setViewingStudent(null);
          }}
        >
          <div className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <p className="font-[600] text-[20px] text-[#232A25]">Student details</p>
              <button type="button" className="text-[#747775]" onClick={() => setViewingStudent(null)}>
                <CrossIconSVG width={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-[14px]">
              <p>
                <span className="text-[#747775]">Name: </span>
                <span className="text-[#232A25]">{getClassStudentDisplayName(viewingStudent)}</span>
              </p>
              <p>
                <span className="text-[#747775]">Student ID: </span>
                <span className="text-[#232A25]">{viewingStudent.student?.student_public_id || "—"}</span>
              </p>
              <p>
                <span className="text-[#747775]">Email/Phone: </span>
                <span className="text-[#232A25]">{getClassStudentContact(viewingStudent)}</span>
              </p>
              <p>
                <span className="text-[#747775]">Status: </span>
                <span className="text-[#232A25]">{viewingStudent.status}</span>
              </p>
              {viewingStudent.joined_at && (
                <p>
                  <span className="text-[#747775]">Joined: </span>
                  <span className="text-[#232A25]">{dayjs(viewingStudent.joined_at).format("MMM D, YYYY")}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isTeacher && <AddStudentModal fetchClassDetails={fetch} />}
    </div>
  );
};

export default ClassStudent;
