"use client";

import { useTranslations } from "next-intl";
import useScoreText from "@/component/GradingScale/useScoreText";
import GradingQuestionList from "./GradingQuestionList";

/** A graded submission: total score and the marked answer sheet (read-only). */
const GradingResultView = ({ data }: GradingModalResultViewProps) => {
  const t = useTranslations("grading.modal");
  const scoreText = useScoreText();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{t("answerSheet")}</h3>
        <p className="text-body font-semibold text-primary">
          {t("score", {
            score: scoreText({
              score: data.submission.totalScore ?? 0,
              max: data.submission.maxScore ?? 0,
              percentage: data.submission.percentage,
              grade: data.submission.grade,
            }),
          })}
        </p>
      </div>
      <GradingQuestionList items={data.items} isReadOnly={true} />
    </div>
  );
};

export default GradingResultView;
