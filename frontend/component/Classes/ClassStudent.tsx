import useApproveStudent from "@/hooks/api/class/useApproveStudent";
import useRemoveStudentFromClass from "@/hooks/api/class/useRemoveStudentFromClass";
import { useEffect, useState } from "react";
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

const ClassStudent = ({ student, classId, fetch }: { student: ClassStudent[]; classId: string; fetch: () => void }) => {
  const dispatch = useAppDispatch();
  const [searchStudentInput, setSearchStudentInput] = useState("");
  const [filteredStudent, setFilteredStudent] = useState<{ pending: ClassStudent[]; active: ClassStudent[] }>({
    pending: [],
    active: [],
  });

  useEffect(() => {
    if (student.length > 0 && searchStudentInput.trim() === "") {
      setFilteredStudent({
        pending: student.filter((item) => item.status === "PENDING"),
        active: student.filter((item) => item.status !== "PENDING").sort((a, b) => (a.status === "JOINED" ? 0 : 1)),
      });
    } else if (student.length > 0 && searchStudentInput.trim() !== "") {
      const searchTerm = searchStudentInput.toLowerCase();
      const filtered = student.filter((item) => {
        const fullName = item.student?.full_name?.toLowerCase() || "";
        const email = item.student?.email?.toLowerCase() || item.invited_email?.toLowerCase() || "";
        const phone = item.student?.phone || item.invited_phone || "";

        return fullName.includes(searchTerm) || email.includes(searchTerm) || phone.includes(searchTerm);
      });
      setFilteredStudent({
        pending: filtered.filter((item) => item.status === "PENDING"),
        active: filtered.filter((item) => item.status !== "PENDING").sort((a, b) => (a.status === "JOINED" ? -1 : 1)),
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

  return (
    <div className="p-2 sm:p-4 bg-white rounded-[8px] h-full">
      <div className="flex justify-between items-center">
        <p className="font-[500] text-[24px] leading-[24px] tracking-[-0.02em] text-[#232A25]">Students</p>
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

      {filteredStudent.active?.length > 0 && (
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

      <AddStudentModal fetchClassDetails={fetch} />
    </div>
  );
};

export default ClassStudent;

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
