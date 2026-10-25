"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/design/ui";
import useGradingSubmissionFooter from "@/hooks/grading/useGradingSubmissionFooter";
import GradingQuestionList from "./GradingQuestionList";

/** Mark the hand-graded answers of a submission, then save. */
const GradingEditView = ({ data }: GradingModalEditViewProps) => {
  const t = useTranslations("grading.modal");
  const { handleClose, handleSubmit, isSubmitting, isSubmitDisabled } = useGradingSubmissionFooter();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-body font-semibold text-ink">{t("answerSheet")}</h3>
        <p className="text-body-sm text-ink-muted">
          {t("manualProgress", { done: data.totals.manualGradedCount, total: data.totals.manualTotalCount })}
        </p>
      </div>
      <GradingQuestionList items={data.items} isReadOnly={false} />
      <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-2 border-t border-border bg-surface px-5 py-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={handleClose}>
          {t("close")}
        </Button>
        <Button loading={isSubmitting} disabled={isSubmitDisabled} onClick={() => void handleSubmit()}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </div>
    </div>
  );
};

export default GradingEditView;
