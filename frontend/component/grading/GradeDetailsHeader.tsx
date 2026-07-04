import ButtonLoader from "../Loader/ButtonLoadder";
import useDownloadExamResults from "@/hooks/api/grading/useDownloadExamResults";
import usePublishGradeResults from "@/hooks/api/grading/usePublishGradeResults";
import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import DownloadIconSVG from "../svg/DownloadIconSVG";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";

const GradeDetailsHeader = ({ refetchGradeDetails }: { refetchGradeDetails: () => Promise<unknown> }) => {
  const { exam, stats } = useAppSelector((state) => state.gradeDetails);
  const [publishGradeResults, { loading: isPublishing }] = usePublishGradeResults();
  const { download, loading: isDownloading } = useDownloadExamResults();
  const isPublishDisabled = Boolean(
    !exam?.id ||
    exam.grading_status === "PUBLISHED" ||
    isPublishing ||
    !stats ||
    stats.submissions <= 0 ||
    stats.submissions !== stats.graded ||
    stats.pending !== 0,
  );

  const handlePublishResult = async () => {
    if (!exam?.id || isPublishDisabled) {
      return;
    }

    const response = await publishGradeResults({ examId: exam.id });

    if (response?.status !== 201) {
      return;
    }

    await refetchGradeDetails();
  };

  const handleDownloadResults = async () => {
    if (!exam?.id || isDownloading) {
      return;
    }

    await download(exam.id, exam.test_name || "exam-results");
  };

  return (
    <>
      <Link href="/grading" className="w-max">
        <button className="flex h-[32px] w-[128px] items-center justify-center gap-2 rounded-[43px] border border-[#E5E5E5] text-[12px] font-[500] text-[#747775] sm:h-[40px] sm:w-[158px] sm:text-[14px]">
          <LeftArrowIconSVG width={16} />
          <span className="mb-[2px] capitalize">Back to Grading</span>
        </button>
      </Link>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[32px] font-[600] leading-[32px] tracking-[-0.04em]">{exam?.test_name || "Grade Details"}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Download Results"
            onClick={handleDownloadResults}
            disabled={isDownloading || !stats || stats.submissions <= 0}
            className="flex h-[32px] w-[32px] items-center justify-center rounded-xl border border-[#E5E5E5] text-[#232A25] disabled:opacity-50 sm:h-[40px] sm:w-[40px]"
          >
            <ButtonLoader show={isDownloading} w="w-4" h="h-4" />
            {!isDownloading && <DownloadIconSVG width={16} />}
          </button>
          <button
            type="button"
            onClick={handlePublishResult}
            disabled={isPublishDisabled}
            className="flex h-[32px] w-[108px] items-center justify-center rounded-xl bg-[#49734F] text-[12px] font-[500] text-white disabled:bg-[#747775] sm:h-[40px] sm:w-[128px] sm:text-[14px]"
          >
            <ButtonLoader show={isPublishing} w="w-4" h="h-4" mr="mr-2" />
            {isPublishing ? "Publishing..." : exam?.grading_status === "PUBLISHED" ? "Published" : "Publish Result"}
          </button>
        </div>
      </div>
    </>
  );
};

export default GradeDetailsHeader;
