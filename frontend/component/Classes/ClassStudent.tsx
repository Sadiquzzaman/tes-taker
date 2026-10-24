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
    <div className="p-2 sm:p-4 bg-surface rounded-input h-full">
      <div className="flex justify-between items-center">
        <p className="font-medium text-title text-ink">Students</p>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-border rounded-input flex items-center justify-center">
              <SortIconSVG />
            </div>
            <button
              onClick={() => dispatch(setOpenAddStudentModal({ id: classId }))}
              className="flex items-center justify-center gap-2 w-[108px] sm:w-[128px] h-[32px] bg-primary rounded-input font-medium text-ink-inverse font-medium text-caption sm:text-body-sm"
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
        parentClassName="w-full border-border rounded-input h-[40px] my-4"
        inputClassName="text-body-sm font-normal placeholder:text-ink-muted px-2"
      />

      {isTeacher && (
        <>
          <p className="font-medium text-title-sm text-primary my-4">
            Pending approvals ({filteredStudent.pending.length})
          </p>

          {filteredStudent.pending.length > 0 && (
            <table className="my-4 min-w-[400px] w-full table-fixed">
              <thead>
                <tr className="text-left font-medium text-body-sm text-ink border-b border-border h-10">
                  <th className="p-2 w-[30%] whitespace-nowrap">Student</th>
                  <th className="p-2 whitespace-nowrap">Email/Phone</th>
                  <th className="p-2 w-[105px] whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudent.pending.map((item) => (
                  <tr
                    key={item.id}
                    className="text-left font-normal text-body-sm text-ink-muted border-b border-border h-10"
                  >
                    <td className="p-2 whitespace-nowrap">{getClassStudentDisplayName(item)}</td>
                    <td className="p-2 whitespace-nowrap">{getClassStudentContact(item)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveStudent(item.student_id)}
                          className="w-6 h-6 flex justify-center items-center text-primary"
                        >
                          <TickSignIconSVG />
                        </button>
                        <button
                          onClick={() => handleRemoveStudent(item)}
                          className="w-6 h-6 flex justify-center items-center text-danger"
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

      <p className="font-medium text-title-sm text-primary my-4">
        Active Students ({isTeacher ? filteredStudent.activeStudents.length : filteredStudent.classmates.length})
      </p>

      {isTeacher && filteredStudent.activeStudents.length > 0 && (
        <table className="my-4 min-w-[400px] w-full table-fixed">
          <thead>
            <tr className="text-left font-medium text-body-sm text-ink border-b border-border h-10">
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
                className="text-left font-normal text-body-sm text-ink-muted border-b border-border h-10"
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
                      className="w-6 h-6 flex justify-center items-center text-ink-muted hover:text-ink"
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
                        className="w-6 h-6 flex justify-center items-center text-ink-muted hover:text-ink"
                      >
                        <ThreeDotIconSVG width={16} />
                      </button>
                      {openActionId === item.id && (
                        <div className="absolute right-0 z-20 mt-1 w-[160px] rounded-input border border-border bg-surface py-1 shadow-lg">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-body-sm text-ink hover:bg-canvas"
                            onClick={() => {
                              setOpenActionId(null);
                              setViewingStudent(item);
                            }}
                          >
                            View details
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-body-sm text-danger hover:bg-danger-soft"
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
            <tr className="text-left font-medium text-body-sm text-ink border-b border-border h-10">
              <th className="py-2 pr-2 whitespace-nowrap">Student</th>
              <th className="py-2 pl-2 whitespace-nowrap text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudent.classmates.map((item, index) => (
              <tr
                key={`${item.name}-${item.joined_at}-${index}`}
                className="font-normal text-body-sm text-ink-muted border-t border-border h-10"
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
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-title-sm text-ink">Student details</p>
              <button type="button" className="text-ink-muted" onClick={() => setViewingStudent(null)}>
                <CrossIconSVG width={20} />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-body-sm">
              <p>
                <span className="text-ink-muted">Name: </span>
                <span className="text-ink">{getClassStudentDisplayName(viewingStudent)}</span>
              </p>
              <p>
                <span className="text-ink-muted">Student ID: </span>
                <span className="text-ink">{viewingStudent.student?.student_public_id || "—"}</span>
              </p>
              <p>
                <span className="text-ink-muted">Email/Phone: </span>
                <span className="text-ink">{getClassStudentContact(viewingStudent)}</span>
              </p>
              <p>
                <span className="text-ink-muted">Status: </span>
                <span className="text-ink">{viewingStudent.status}</span>
              </p>
              {viewingStudent.joined_at && (
                <p>
                  <span className="text-ink-muted">Joined: </span>
                  <span className="text-ink">{dayjs(viewingStudent.joined_at).format("MMM D, YYYY")}</span>
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
