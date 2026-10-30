"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import GradingQuestionList from "@/component/grading/GradingQuestionList";
import useScoreText from "@/component/GradingScale/useScoreText";
import { Breadcrumb, buttonClasses, Card, ErrorState, PageHeader, Skeleton, StatTile } from "@/design/ui";
import useGetExamResult from "@/hooks/api/exam/useGetExamResult";
import useFormat from "@/i18n/useFormat";
import { mapStudentExamResult } from "@/utils/exam/mapStudentExamResult";

/** A student's result for one test: score, and the marked answer sheet. */
const StudentExamResults = ({ examId }: { examId: string }) => {
  const t = useTranslations("tests");
  const format = useFormat();
  const scoreText = useScoreText();
  const { loading, error, result, refetch } = useGetExamResult(examId);
  const breadcrumb = <Breadcrumb items={[{ label: t("title"), href: "/tests" }, { label: t("results.title") }]} />;

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8" aria-busy="true">
        <Skeleton className="h-8 w-1/3" />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
        {breadcrumb}
        <Card>
          <ErrorState description={t("results.failed")} onRetry={() => void refetch()} />
          <div className="flex justify-center pb-4">
            <Link href="/tests" className={buttonClasses({ variant: "ghost" })}>
              {t("details.back")}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const gradingData = mapStudentExamResult(result);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      <PageHeader
        breadcrumb={breadcrumb}
        title={t("results.title")}
        description={[result.subject ?? t("results.fallbackSubject"), result.submitted_at ? t("results.submitted", { date: format.dateTime(result.submitted_at) }) : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label={t("results.score")}
          value={scoreText({ score: result.total_score ?? 0, max: result.max_score ?? 0, percentage: result.percentage, grade: result.grade })}
        />
        {result.grade ? (
          <StatTile
            label={t("results.grade")}
            value={result.grade.gpa === null ? result.grade.grade : `${result.grade.grade} · ${format.number(result.grade.gpa, { minimumFractionDigits: 2 })}`}
          />
        ) : null}
      </div>
      <Card title={t("results.answerSheet")}>
        <GradingQuestionList items={gradingData.items} isReadOnly={true} />
      </Card>
    </div>
  );
};

export default StudentExamResults;
