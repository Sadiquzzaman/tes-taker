import ButtonLoader from "../Loader/ButtonLoadder";
import usePublishGradeResults from "@/hooks/api/grading/usePublishGradeResults";
import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";

const GradeDetailsHeader = ({ refetchGradeDetails }: { refetchGradeDetails: () => Promise<unknown> }) => {
  const { exam, stats } = useAppSelector((state) => state.gradeDetails);
  const [publishGradeResults, { loading: isPublishing }] = usePublishGradeResults();
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

  return (
    <>
      <Link href="/grading" className="w-max">
        <button className="flex h-[32px] w-[128px] items-center justify-center gap-2 rounded-[43px] border border-[#E5E5E5] text-[12px] font-[500] text-[#747775] sm:h-[40px] sm:w-[158px] sm:text-[14px]">
          <LeftArrowIconSVG width={16} />
          <span className="mb-[2px] capitalize">Back to Grading</span>
        </button>
      </Link>

      <div className="flex items-center justify-between">
        <p className="text-[32px] font-[600] leading-[32px] tracking-[-0.04em]">{exam?.test_name || "Grade Details"}</p>
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
    </>
  );
};

export default GradeDetailsHeader;
