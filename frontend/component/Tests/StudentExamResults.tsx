"use client";

import Link from "next/link";
import GradingQuestionList from "@/component/grading/GradingQuestionList";
import useGetExamResult from "@/hooks/api/exam/useGetExamResult";
import { mapStudentExamResult } from "@/utils/exam/mapStudentExamResult";

const StudentExamResults = ({ examId }: { examId: string }) => {
  const { loading, error, result, refetch } = useGetExamResult(examId);

  if (loading) {
    return (
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-6 animate-pulse min-h-[240px]" />
    );
  }

  if (error) {
    return (
      <div className="rounded-[12px] border border-[#F2C6C6] bg-[#FFF5F5] p-6 flex flex-col gap-4">
        <p className="text-[16px] font-[500] leading-[20px] text-[#232A25]">{error}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-[8px] bg-[#49734F] px-4 py-2 text-[14px] font-[500] text-white"
          >
            Retry
          </button>
          <Link href="/tests" className="rounded-[8px] border border-[#49734F] px-4 py-2 text-[14px] font-[500] text-[#49734F]">
            Back to tests
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const gradingData = mapStudentExamResult(result);
  const totalScore = result.total_score ?? 0;
  const maxScore = result.max_score ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-[400] leading-[16px] text-[#747775]">{result.subject ?? "Exam result"}</p>
            <h1 className="mt-2 text-[24px] font-[500] leading-[28px] tracking-[-0.02em] text-[#232A25]">
              Your results
            </h1>
            {result.submitted_at ? (
              <p className="mt-2 text-[14px] font-[400] leading-[16px] text-[#747775]">
                Submitted {new Date(result.submitted_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[20px] font-[500] leading-[24px] text-[#49734F]">
              Score: {totalScore}/{maxScore}
            </p>
            {result.percentage != null ? (
              <p className="mt-1 text-[14px] font-[400] leading-[16px] text-[#747775]">{result.percentage}%</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-6">
        <p className="text-[20px] font-[500] leading-[20px] tracking-[-0.02em] text-[#747775]">Answer sheet</p>
        <div className="mt-4">
          <GradingQuestionList items={gradingData.items} isReadOnly={true} />
        </div>
      </div>
    </div>
  );
};

export default StudentExamResults;
