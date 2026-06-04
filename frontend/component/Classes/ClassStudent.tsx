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

      {isTeacher && <AddStudentModal fetchClassDetails={fetch} />}
    </div>
  );
};

export default ClassStudent;
