import ButtonLoader from "@/component/Loader/ButtonLoadder";
import ExamCountdown from "@/component/Tests/ExamCountdown";
import StudentExamSection from "@/component/Tests/exam/StudentExamSection";
import ExamTimerIconSVG from "@/component/svg/ExamTimerIconSVG";
import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";
import { buildStudentExamViewModel } from "@/utils/tests/studentExamViewModel";

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
  const examView = buildStudentExamViewModel(exam);
  const showSectionTitles = examView.sections.length > 1;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 py-8 md:px-0">
        <section className="relative h-[200px] overflow-hidden rounded-[16px] bg-[#49734F] text-white">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(17,34,21,0.16)),radial-gradient(circle_at_50%_100%,rgba(15,26,18,0.38),transparent_45%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.20),transparent_28%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[130px] bg-[linear-gradient(180deg,transparent,rgba(26,46,31,0.55))]" />
          <div className="absolute -left-[120px] -top-[84px] h-[162px] w-[183px] rounded-full border border-white/15 opacity-70" />
          <div className="absolute -right-[56px] top-[70px] h-[120px] w-[120px] rounded-full border border-white/10 opacity-70" />

          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="max-w-[360px] font-ins-sans text-[32px] font-[600] leading-[32px] tracking-[-0.04em]">
              {exam.test_name}
            </p>
            <p className="mt-3 text-[16px] leading-4 tracking-[-0.02em] text-white/90">
              <span className="font-[600]">Sub</span>: {examView.summary.subjectSummary}
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 px-1 md:flex-row md:items-center md:justify-between">
          <p className="text-[16px] font-[500] leading-4 tracking-[-0.02em] text-[#232A25]">
            Total Marks: {examView.summary.totalMarks}
          </p>

          <div className="flex items-center gap-2 text-[#49734F]">
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
        </section>

        <div className="flex flex-col gap-4 rounded-[8px] bg-[#EFF0F3] p-4">
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
            />
          ))}
        </div>

        <div className="flex justify-center pb-4">
          <button
            ref={submitButtonRef}
            onClick={onSubmit}
            disabled={isInteractionDisabled}
            className={`flex h-11 items-center justify-center rounded-[10px] px-5 text-[14px] font-[600] leading-4 text-white ${
              isInteractionDisabled ? "bg-[#8BA28F]" : "bg-[#49734F]"
            }`}
          >
            <ButtonLoader show={isSubmitLoading} w="w-4" h="h-4" mr="mr-2" />
            {isSubmitLoading ? "Submitting..." : "Submit Answer"}
            <RightArrowIconSVG className="ml-2 size-4" />
          </button>
        </div>
      </div>
    </main>
  );
};

export default StudentExamMain;
