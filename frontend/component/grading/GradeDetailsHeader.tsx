import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import LeftArrowIconSVG from "../svg/LeftArrowIconSVG";

const GradeDetailsHeader = () => {
  const exam = useAppSelector((state) => state.gradeDetails.exam);

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
          disabled
          className="h-[32px] w-[108px] rounded-xl bg-[#49734F] text-[12px] font-[500] text-white disabled:bg-[#747775] sm:h-[40px] sm:w-[128px] sm:text-[14px]"
        >
          Publish Result
        </button>
      </div>
    </>
  );
};

export default GradeDetailsHeader;
