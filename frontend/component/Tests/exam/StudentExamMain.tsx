"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import ExamCountdown from "@/component/Tests/ExamCountdown";
import StudentExamSection from "@/component/Tests/exam/StudentExamSection";
import ExamTimerIconSVG from "@/component/svg/ExamTimerIconSVG";
import { Button, Card, ConfirmDialog, MenuIcon, Sheet } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { buildStudentExamViewModel } from "@/utils/tests/studentExamViewModel";
import QuestionNavigator, { isAnswered } from "./QuestionNavigator";

interface StudentExamMainProps {
  exam: StudentExamDetails;
  answerState: ExamAnswerState;
  isInteractionDisabled: boolean;
  isSubmitLoading: boolean;
  submitButtonRef: React.RefObject<HTMLButtonElement | null>;
  onAnswerChange: (questionId: string, value: ExamAnswerValue) => void;
  onMatchingChange: (questionId: string, value: string[]) => void;
  onSubmit: () => void;
  onCountdownStart: () => void;
  onTimeUp: () => void;
}

/**
 * The calm exam screen (design-system §3.4): test name and timer on top, the questions, and a
 * question list showing what is answered or flagged. Submitting asks once, with the count left.
 */
const StudentExamMain = ({
  exam,
  answerState,
  isInteractionDisabled,
  isSubmitLoading,
  submitButtonRef,
  onAnswerChange,
  onMatchingChange,
  onSubmit,
  onCountdownStart,
  onTimeUp,
}: StudentExamMainProps) => {
  const t = useTranslations("exam");
  const format = useFormat();
  const examView = buildStudentExamViewModel(exam);
  const showSectionTitles = examView.sections.length > 1;
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const questions = useMemo(
    () =>
      examView.sections.flatMap((section) =>
        section.items.flatMap((item) =>
          item.kind === "passage"
            ? item.questions.map((question) => ({ id: question.id, number: question.questionNumber }))
            : [{ id: item.question.id, number: item.question.questionNumber }],
        ),
      ),
    [examView.sections],
  );
  const unanswered = questions.filter((question) => !isAnswered(answerState[question.id])).length;

  const toggleFlag = (questionId: string) =>
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });

  const jumpTo = (questionId: string) => {
    setNavigatorOpen(false);
    const target = document.getElementById(`exam-q-${questionId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  };

  const navigator = <QuestionNavigator questions={questions} answerState={answerState} flagged={flagged} onJump={jumpTo} />;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-body font-semibold text-ink">{exam.test_name}</h1>
            <p className="truncate text-caption text-ink-muted">
              {t("subject")}: {examView.summary.subjectSummary} · {t("totalMarks", { marks: examView.summary.totalMarks })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-input bg-primary-soft px-3 py-1.5 text-primary" aria-label={t("timeLeftLabel")}>
              <ExamTimerIconSVG width={16} />
              <ExamCountdown
                key={`${exam.id}-${exam.remaining_time_seconds ?? exam.formState.duration}`}
                remainingSeconds={exam.remaining_time_seconds}
                durationMinutes={exam.formState.duration}
                submitButtonRef={submitButtonRef}
                onStart={onCountdownStart}
                onTimeUp={onTimeUp}
              />
            </div>
            <Button variant="secondary" size="sm" className="lg:hidden" leftIcon={<MenuIcon />} onClick={() => setNavigatorOpen(true)}>
              {format.number(questions.length - unanswered)}/{format.number(questions.length)}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_240px]">
        <div className="flex min-w-0 flex-col gap-6">
          {examView.sections.map((section) => (
            <StudentExamSection
              key={section.id}
              section={section}
              answerState={answerState}
              disabled={isInteractionDisabled}
              isNegativeMarkingEnabled={exam.formState.allowNegativeMarking}
              negativeMarkValue={Number(exam.formState.negativeMarking ?? 0)}
              showTitle={showSectionTitles}
              onAnswerChange={onAnswerChange}
              onMatchingChange={onMatchingChange}
              flagged={flagged}
              onToggleFlag={toggleFlag}
            />
          ))}

          <div className="flex justify-center pb-8">
            <Button
              ref={submitButtonRef}
              size="lg"
              loading={isSubmitLoading}
              disabled={isInteractionDisabled}
              onClick={() => setConfirmSubmit(true)}
            >
              {isSubmitLoading ? t("submitting") : t("submit")}
            </Button>
          </div>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-24">{navigator}</Card>
        </aside>
      </div>

      <Sheet open={navigatorOpen} onClose={() => setNavigatorOpen(false)} title={t("navigator.open")}>
        {navigator}
      </Sheet>

      <ConfirmDialog
        open={confirmSubmit}
        title={t("submitTitle")}
        description={t("submitDetail", { open: unanswered })}
        confirmLabel={t("submitConfirm")}
        cancelLabel={t("keepWorking")}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          onSubmit();
        }}
      />
    </main>
  );
};

export default StudentExamMain;
