import {
  setCurrentPage,
  setOpenModal,
  setSearchStudentInput,
  setSelectedSubmission,
} from "@/lib/features/gradeDetailsSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import NormalInput from "@/Ui/NormalInput";
import { statusButtonText, statusColors, statusTextColors } from "@/utils/grading/gradeDetails";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";
import SortIconSVG from "../svg/SortIconSVG";
import dayjs from "dayjs";

const formatSubmittedAt = (value: string | null) => {
  if (!value) {
    return "N/A";
  }

  return dayjs(value).format("hh:mm A");
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
    <div className="w-full min-w-0 rounded-input bg-surface p-2 sm:p-4">
      <div className="flex items-center justify-between">
        <p className="text-title font-medium text-ink">
          Student Submissions Table
        </p>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-input bg-canvas">
            <SortIconSVG />
          </div>
        </div>
      </div>

      <NormalInput
        placeholder="Search Student"
        value={searchStudentInput}
        onChange={(event) => dispatch(setSearchStudentInput(event.target.value))}
        parentClassName="my-8 h-[40px] w-full rounded-input border-border"
        inputClassName="px-2 text-body-sm font-normal placeholder:text-ink-muted"
      />

      <div
        className="w-full"
        style={{
          overflowX: "auto",
        }}
      >
        <table className="min-w-[800px] w-full table-fixed">
          <thead>
            <tr className="h-10 border-b border-border text-left text-body-sm font-medium text-ink">
              <th className="p-2 whitespace-nowrap">Student</th>
              <th className="p-2 whitespace-nowrap">Email/Phone</th>
              <th className="p-2 text-center whitespace-nowrap">Submitted At</th>
              <th className="p-2 text-center whitespace-nowrap">Exam Status</th>
              <th className="p-2 text-center whitespace-nowrap">Grading</th>
              <th className="p-2 text-center whitespace-nowrap">Score</th>
              <th className="p-2 text-center whitespace-nowrap">Violations</th>
              <th className="p-2 text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr className="h-16 border-b border-border text-center text-body-sm font-normal text-ink-muted">
                <td colSpan={8}>No submissions found</td>
              </tr>
            )}

            {submissions.map((student) => (
              <tr
                key={student.submission_id}
                className="h-10 border-b border-border text-left text-body-sm font-normal text-ink-muted"
              >
                <td className="p-2 whitespace-nowrap">{student.student_name || "Anonymous"}</td>
                <td className="p-2 whitespace-nowrap">{student.email || student.phone || "N/A"}</td>
                <td className="p-2 text-center whitespace-nowrap">{formatSubmittedAt(student.submitted_at)}</td>
                <td className="p-2 text-center whitespace-nowrap" title={student.disqualification_reason ?? undefined}>
                  {student.status}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  <span
                    className="rounded-full border px-2 py-1 text-caption font-medium"
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
                  {student.proctoring_summary?.total_violations ?? 0}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  <button
                    style={{ backgroundColor: statusTextColors[student.grading_status] }}
                    onClick={() => handleOpenStudentModal(student)}
                    className="mx-auto flex items-center justify-center rounded-input px-4 py-2 text-ink-inverse"
                  >
                    {statusButtonText[student.grading_status]}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex h-8 w-full items-center justify-center gap-6">
        <div className="flex h-8 w-[272px] items-center justify-center gap-2 opacity-80">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-input bg-surface p-2 text-ink disabled:opacity-50"
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
                  className={`flex h-8 w-8 items-center justify-center rounded-input border px-2 py-2 text-body-sm font-normal leading-4 ${
                    currentPage === pageNumber
                      ? "border-ink bg-surface text-ink"
                      : "border-border bg-surface text-ink-muted"
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
                  className="flex h-8 w-8 items-center justify-center rounded-input bg-surface px-2 py-2 text-body-sm font-normal leading-4 text-ink-muted"
                >
                  ...
                </span>
              );
            }

            return null;
          })}

          <button
            className="flex h-8 w-8 items-center justify-center rounded-input bg-surface p-2 text-ink disabled:opacity-50"
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
