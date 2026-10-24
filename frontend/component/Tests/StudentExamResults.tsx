"use client";

import Link from "next/link";
import GradingQuestionList from "@/component/grading/GradingQuestionList";
import useGetExamResult from "@/hooks/api/exam/useGetExamResult";
import { mapStudentExamResult } from "@/utils/exam/mapStudentExamResult";

const StudentExamResults = ({ examId }: { examId: string }) => {
  const { loading, error, result, refetch } = useGetExamResult(examId);

  if (loading) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 animate-pulse min-h-[240px]" />
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-danger-soft bg-danger-soft p-6 flex flex-col gap-4">
        <p className="text-body font-medium text-ink">{error}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-input bg-primary px-4 py-2 text-body-sm font-medium text-ink-inverse"
          >
            Retry
          </button>
          <Link href="/tests" className="rounded-input border border-primary px-4 py-2 text-body-sm font-medium text-primary">
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
      <div className="rounded-card border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-body-sm font-normal text-ink-muted">{result.subject ?? "Exam result"}</p>
            <h1 className="mt-2 text-title font-medium text-ink">
              Your results
            </h1>
            {result.submitted_at ? (
              <p className="mt-2 text-body-sm font-normal text-ink-muted">
                Submitted {new Date(result.submitted_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-title-sm font-medium text-primary">
              Score: {totalScore}/{maxScore}
            </p>
            {result.percentage != null ? (
              <p className="mt-1 text-body-sm font-normal text-ink-muted">{result.percentage}%</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <p className="text-title-sm font-medium text-ink-muted">Answer sheet</p>
        <div className="mt-4">
          <GradingQuestionList items={gradingData.items} isReadOnly={true} />
        </div>
      </div>
    </div>
  );
};

export default StudentExamResults;
