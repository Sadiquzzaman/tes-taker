import { setCurrentPage, setOpenModal, setSearchStudentInput, setSelectedSubmission } from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import NormalInput from "@/Ui/NormalInput";
import { statusButtonText, statusColors, statusTextColors } from "@/utils/grading/gradeDetails";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";
import SortIconSVG from "../svg/SortIconSVG";

const formatSubmittedAt = (value: string | null) => {
  if (!value) {
    return "N/A";
  }

  return new Date(value).toLocaleString();
};

const getStudentScore = (student: GradingSubmissionListItem) => {
  if (student.total_score === null || student.max_score === null) {
    return "-";
  }

  return `${student.total_score}/${student.max_score}`;
};

const StudentSubmissionsTable = () => {
  const dispatch = useAppDispatch();
  const { currentPage, searchStudentInput, submissions, totalPages } = useAppSelector((state) => state.gradeDetails);

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) {
      return;
    }

    dispatch(setCurrentPage(page));
  };

  const handleOpenStudentModal = (student: GradingSubmissionListItem) => {
    dispatch(setSelectedSubmission(student));
    dispatch(setOpenModal(student.is_graded ? "result" : "edit"));
  };

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
        onChange={(event) => dispatch(setSearchStudentInput(event.target.value))}
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
          {submissions.length === 0 && (
            <tr className="h-16 border-b border-[#EFF0F3] text-center text-[14px] font-[400] text-[#747775]">
              <td colSpan={6}>No submissions found</td>
            </tr>
          )}

          {submissions.map((student) => (
            <tr
              key={student.submission_id}
              className="h-10 border-b border-[#EFF0F3] text-left text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]"
            >
              <td className="p-2 whitespace-nowrap">{student.student_name || "Anonymous"}</td>
              <td className="p-2 whitespace-nowrap">{student.email || student.phone || "N/A"}</td>
              <td className="p-2 whitespace-nowrap">{formatSubmittedAt(student.submitted_at)}</td>
              <td className="p-2 text-center whitespace-nowrap">
                <span
                  className="rounded-[27px] border px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em]"
                  style={{
                    backgroundColor: statusColors[student.grading_status],
                    borderColor: statusTextColors[student.grading_status],
                    color: statusTextColors[student.grading_status],
                  }}
                >
                  {student.grading_status}
                </span>
              </td>
              <td className="p-2 text-center whitespace-nowrap">{getStudentScore(student)}</td>
              <td className="p-2 text-center whitespace-nowrap">
                <button
                  style={{ backgroundColor: statusTextColors[student.grading_status] }}
                  onClick={() => handleOpenStudentModal(student)}
                  className="mx-auto flex items-center justify-center rounded-[8px] px-4 py-2 text-white"
                >
                  {statusButtonText[student.grading_status]}
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
            onClick={() => handlePageChange(currentPage - 1)}
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
                  onClick={() => handlePageChange(pageNumber)}
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
            onClick={() => handlePageChange(currentPage + 1)}
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
