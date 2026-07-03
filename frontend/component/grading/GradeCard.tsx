import Link from "next/link";
import DownloadIconSVG from "../svg/DownloadIconSVG";
import RemainingIconSVG from "../svg/RemainingIconSVG";
import ShareIconSVG from "../svg/ShareIconSVG";
import { getGradeCardStatusLabel, gradeCardStatusColors, gradeCardStatusTextColors } from "@/utils/grading/gradeCard";

const GradeCard = ({ gradeItem }: GradeCardProps) => {
  const status = gradeItem.grading_status;
  const statusLabel = getGradeCardStatusLabel(gradeItem.grading_status);
  const statusColor = gradeCardStatusTextColors[status];
  const showResultActions = status === "GRADED" || status === "PUBLISHED";
  const totalParticipants = gradeItem.total_participants;
  const submittedCount = gradeItem.submitted_count;
  const gradedCount = gradeItem.graded_count;
  const pendingCount = gradeItem.pending_count;

  return (
    <div className="rounded-[8px] bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[18px] font-[500] leading-[18px] tracking-[-0.02em] text-[#232A25]">
          {gradeItem?.test_name || ""}
        </p>
        <span
          className="rounded-[27px] border px-2 py-1 text-[12px] font-[500] leading-[12px] tracking-[-0.02em]"
          style={{
            backgroundColor: gradeCardStatusColors[status],
            borderColor: statusColor,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center py-4">
        <div className="flex-1">
          <p className="text-[14px] font-[400] leading-[18px] tracking-[-0.02em] text-[#747775]">Submissions</p>
          <p className="mt-2 text-[16px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">
            {submittedCount}/{totalParticipants}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-[400] leading-[18px] tracking-[-0.02em] text-[#747775]">Grading Done</p>
          <p className="mt-2 text-[16px] font-[500] leading-[16px] tracking-[-0.02em] text-[#232A25]">
            {gradedCount}/{submittedCount}
          </p>
        </div>
      </div>

      <div className="my-4 h-[2px] w-full bg-[#EFF0F3]" />

      <div className="flex items-center justify-between">
        {status === "NEEDS_GRADING" && (
          <div className="flex items-center gap-2">
            <RemainingIconSVG />
            <p className="text-[14px] font-[400] uppercase leading-[16px] text-[#232A25]">{pendingCount} Pending</p>
          </div>
        )}

        {showResultActions && (
          <div className="flex items-center gap-2">
            <button
              title="Share Tests"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[#EFF0F3]"
            >
              <ShareIconSVG width={16} />
            </button>
            <button
              title="Download Results"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[#EFF0F3]"
            >
              <DownloadIconSVG width={16} />
            </button>
          </div>
        )}

        <Link href={`/grading/details/${gradeItem.id}`}>
          <button
            className="rounded-lg border px-3 py-2 text-[12px] font-[500] leading-[12px] tracking-[-0.02em] transition-all duration-200"
            style={{ borderColor: statusColor, color: statusColor }}
            onMouseEnter={(event) => {
              event.currentTarget.style.backgroundColor = statusColor;
              event.currentTarget.style.color = "#fff";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "transparent";
              event.currentTarget.style.color = statusColor;
            }}
          >
            {gradeItem.grading_status === "NEEDS_GRADING" ? "Continue Grading" : "Test Results"}
          </button>
        </Link>
      </div>
    </div>
  );
};

export default GradeCard;
