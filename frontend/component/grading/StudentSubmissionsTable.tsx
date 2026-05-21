import NormalInput from "@/Ui/NormalInput";
import { statusButtonText, statusColors, statusTextColors } from "@/utils/grading/gradeDetails";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";
import SortIconSVG from "../svg/SortIconSVG";

interface StudentSubmissionsTableProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  openStudentModal: (view: GradingModalView) => void;
  paginatedStudents: GradingStudent[];
  searchStudentInput: string;
  setSearchStudentInput: (value: string) => void;
  totalPages: number;
}

const StudentSubmissionsTable = ({
  currentPage,
  onPageChange,
  openStudentModal,
  paginatedStudents,
  searchStudentInput,
  setSearchStudentInput,
  totalPages,
}: StudentSubmissionsTableProps) => {
  return (
    <div className="rounded-[8px] bg-white p-2 sm:p-4">
      <div className="flex items-center justify-between">
        <p className="text-[24px] font-[500] leading-[24px] tracking-[-0.02em] text-[#232A25]">
          Student Submissions Table
        </p>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[#EFF0F3]">
            <SortIconSVG />
          </div>
        </div>
      </div>

      <NormalInput
        placeholder="Search Student"
        value={searchStudentInput}
        onChange={(event) => setSearchStudentInput(event.target.value)}
        parentClassName="my-8 h-[40px] w-full rounded-[8px] border-[#E5E5E5]"
        inputClassName="px-2 text-[14px] font-[400] leading-[125%] placeholder:text-[#747775]"
      />

      <table className="min-w-[400px] w-full table-fixed">
        <thead>
          <tr className="h-10 border-b border-[#EFF0F3] text-left text-[14px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">
            <th className="p-2 whitespace-nowrap">Student</th>
            <th className="p-2 whitespace-nowrap">Email/Phone</th>
            <th className="p-2 whitespace-nowrap">Submitted At</th>
            <th className="p-2 text-center whitespace-nowrap">Status</th>
            <th className="p-2 text-center whitespace-nowrap">Score</th>
            <th className="p-2 text-center whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody>
          {paginatedStudents.map((student, index) => (
            <tr
              key={`${student.email}-${index}`}
              className="h-10 border-b border-[#EFF0F3] text-left text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]"
            >
              <td className="p-2 whitespace-nowrap">{student.name}</td>
              <td className="p-2 whitespace-nowrap">{student.email}</td>
              <td className="p-2 whitespace-nowrap">{student.submittedAt}</td>
              <td className="p-2 text-center whitespace-nowrap">
                <span
                  className="rounded-[27px] border px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em]"
                  style={{
                    backgroundColor: statusColors[student.status],
                    borderColor: statusTextColors[student.status],
                    color: statusTextColors[student.status],
                  }}
                >
                  {student.status}
                </span>
              </td>
              <td className="p-2 text-center whitespace-nowrap">{student.score}</td>
              <td className="p-2 text-center whitespace-nowrap">
                <button
                  style={{ backgroundColor: statusTextColors[student.status] }}
                  onClick={() => openStudentModal(student.status === "Graded" ? "result" : "edit")}
                  className="mx-auto flex items-center justify-center rounded-[8px] px-4 py-2 text-white"
                >
                  {statusButtonText[student.status]}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex h-8 w-full items-center justify-center gap-6">
        <div className="flex h-8 w-[272px] items-center justify-center gap-2 opacity-80">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white p-2 text-[#232A25] disabled:opacity-50"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <PaginationChevronLeftIconSVG width={16} />
          </button>

          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            const shouldShowPage = index === 0 || index === totalPages - 1 || Math.abs(pageNumber - currentPage) <= 1;
            const shouldShowEllipsis =
              (index === 1 && currentPage > 3) || (index === totalPages - 2 && currentPage < totalPages - 2);

            if (shouldShowPage) {
              return (
                <button
                  key={pageNumber}
                  className={`flex h-8 w-8 items-center justify-center rounded-[6px] border px-2 py-2 text-[14px] font-[400] leading-4 tracking-[-0.02em] ${
                    currentPage === pageNumber
                      ? "border-[#232A25] bg-white text-[#232A25]"
                      : "border-[#E5E5E5] bg-white text-[#747775]"
                  }`}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              );
            }

            if (shouldShowEllipsis) {
              return (
                <span
                  key={`ellipsis-${pageNumber}`}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white px-2 py-2 text-[14px] font-[400] leading-4 tracking-[-0.02em] text-[#747775]"
                >
                  ...
                </span>
              );
            }

            return null;
          })}

          <button
            className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-white p-2 text-[#232A25] disabled:opacity-50"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <PaginationChevronRightIconSVG width={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentSubmissionsTable;
