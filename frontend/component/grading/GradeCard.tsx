import useDownloadExamResults from "@/hooks/api/grading/useDownloadExamResults";
import Link from "next/link";
import DownloadIconSVG from "../svg/DownloadIconSVG";
import RemainingIconSVG from "../svg/RemainingIconSVG";
import ShareIconSVG from "../svg/ShareIconSVG";
import { getGradeCardStatusLabel, gradeCardStatusColors, gradeCardStatusTextColors } from "@/utils/grading/gradeCard";
import ButtonLoader from "../Loader/ButtonLoadder";

const GradeCard = ({ gradeItem }: GradeCardProps) => {
  const { download, loading: isDownloading } = useDownloadExamResults();
  const status = gradeItem.grading_status;
  const statusLabel = getGradeCardStatusLabel(gradeItem.grading_status);
  const statusColor = gradeCardStatusTextColors[status];
  const showResultActions = status === "GRADED" || status === "PUBLISHED";
  const totalParticipants = gradeItem.total_participants;
  const submittedCount = gradeItem.submitted_count;
  const gradedCount = gradeItem.graded_count;
  const pendingCount = gradeItem.pending_count;

  const handleDownloadResults = async () => {
    if (isDownloading || submittedCount <= 0) {
      return;
    }

    await download(gradeItem.id, gradeItem.test_name || "exam-results");
  };

  return (
    <div className="rounded-input bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-title-sm font-medium text-ink">
          {gradeItem?.test_name || ""}
        </p>
        <span
          className="rounded-full border px-2 py-1 text-caption font-medium"
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
          <p className="text-body-sm font-normal text-ink-muted">Submissions</p>
          <p className="mt-2 text-body font-medium text-ink">
            {submittedCount}/{totalParticipants}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-body-sm font-normal text-ink-muted">Grading Done</p>
          <p className="mt-2 text-body font-medium text-ink">
            {gradedCount}/{submittedCount}
          </p>
        </div>
      </div>

      <div className="my-4 h-[2px] w-full bg-canvas" />

      <div className="flex items-center justify-between">
        {status === "NEEDS_GRADING" && (
          <div className="flex items-center gap-2">
            <RemainingIconSVG />
            <p className="text-body-sm font-normal uppercase text-ink">{pendingCount} Pending</p>
          </div>
        )}

        {showResultActions && (
          <div className="flex items-center gap-2">
            <button
              title="Share Tests"
              className="flex h-8 w-8 items-center justify-center rounded-input hover:bg-canvas"
            >
              <ShareIconSVG width={16} />
            </button>
            <button
              type="button"
              title="Download Results"
              disabled={isDownloading || submittedCount <= 0}
              onClick={handleDownloadResults}
              className="flex h-8 w-8 items-center justify-center rounded-input hover:bg-canvas disabled:opacity-50"
            >
              {isDownloading ? <ButtonLoader show={true} w="w-4" h="h-4" /> : <DownloadIconSVG width={16} />}
            </button>
          </div>
        )}

        <Link href={`/grading/details/${gradeItem.id}`}>
          <button
            className="rounded-lg border px-3 py-2 text-caption font-medium transition-all duration-200"
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
