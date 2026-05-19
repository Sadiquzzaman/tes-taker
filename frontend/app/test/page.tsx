"use client";

import ButtonLoader from "@/component/Loader/ButtonLoadder";
import ExamCountdown from "@/component/Tests/ExamCountdown";
import CreateModal from "@/component/Tests/Create/CreateModal";
import ExamTimerIconSVG from "@/component/svg/ExamTimerIconSVG";
import RightArrowIconSVG from "@/component/svg/RightArrowIconSVG";
import useStudentExam from "@/hooks/api/exam/useStudentExam";
import useSubmitAnswersheet from "@/hooks/api/tests/useSubmitAnswersheet";
import { useEffect, useRef, useState } from "react";
import { RotatingLines } from "react-loader-spinner";
import { useRouter } from "next/navigation";
import EssayQuestionSectionCard from "@/component/Tests/exam/EssayQuestionSectionCard";
import ObjectiveQuestionSectionCard from "@/component/Tests/exam/ObjectiveQuestionSectionCard";
import ExamHeader from "@/component/Tests/exam/ExamHeader";

export default function ParticipateTest() {
  const router = useRouter();
  const { examData: test, loading, apiComplete } = useStudentExam();
  const [submitAnswersheet, { loading: submitLoading }] = useSubmitAnswersheet();

  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const [submitReason, setSubmitReason] = useState<"manual" | "timeout" | null>(null);
  const [answerSheet, setAnswerSheet] = useState<AnswersheetMap>({});
  const isInteractionDisabled = loading || submitLoading;

  const handleSubmit = async (reason: "manual" | "timeout" = "manual") => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }

    setSubmitReason(reason);

    const parsedUser = JSON.parse(user) as { id?: string };
    const examId = test?.id ?? "";
    const studentId = parsedUser?.id ?? "";

    const response = await submitAnswersheet({
      examId,
      payload: {
        studentId,
        answersheet: answerSheet,
      },
    });
  };

  useEffect(() => {
    if (test?.subjects?.length) {
      const initialAnswerSheet: { [key: string]: string } = answerSheet;

      test.subjects.forEach((subject) => {
        subject.questionSections.forEach((section) => {
          section.questions.forEach((question) => {
            if (!initialAnswerSheet[question.id]) {
              initialAnswerSheet[question.id] = "";
            }
          });
        });
      });
      setAnswerSheet(initialAnswerSheet);
    }
  }, [test]);

  if (loading)
    return (
      <div className="w-full min-h-[calc(100vh-300px)] flex items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="grey"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="rotating-lines-loading"
          wrapperStyle={{}}
          wrapperClass=""
        />
      </div>
    );

  if (!apiComplete) return null;

  if (!test) {
    return (
      <div className="w-full min-h-[calc(100vh-162px)] flex items-center justify-center">
        <div className="text-center">
          <p className="font-[600] text-[24px] leading-[32px] tracking-[-0.04em] text-[#232A25]">
            Unable to load the test.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ExamHeader />
      <main className="w-full overflow-auto" style={{ height: "calc(100vh - 72px)" }}>
        <div className="w-full md:w-[60%] mx-auto py-8 flex flex-col gap-8">
          <div className="flex justify-between items-center">
            <p className="font-[600] text-[32px] leading-[32px] text-[#232A25]">{test?.test_name ?? "Loading test"}</p>
            <div className="flex items-center gap-4">
              <ExamTimerIconSVG width={16} />
              <ExamCountdown
                key={test?.id ?? "exam-countdown"}
                durationMinutes={test?.duration_minutes}
                submitButtonRef={submitButtonRef}
                onTimeUp={() => handleSubmit("timeout")}
              />
            </div>
          </div>

          {test?.subjects.map((subject) => {
            return subject.questionSections.map((section) => {
              if (section.type === "essay") {
                return (
                  <EssayQuestionSectionCard
                    key={section.id}
                    section={section}
                    answerSheet={answerSheet}
                    setAnswerSheet={setAnswerSheet}
                    examType={test.exam_type}
                    subjectName={subject.name}
                    disabled={isInteractionDisabled}
                  />
                );
              }

              if (section.type === "objective") {
                return (
                  <ObjectiveQuestionSectionCard
                    key={section.id}
                    section={section}
                    negativeMarkValue={test.negative_mark_value}
                    answerSheet={answerSheet}
                    setAnswerSheet={setAnswerSheet}
                    isNegativeMarkingEnabled={test.is_negative_marking}
                    examType={test.exam_type}
                    subjectName={subject.name}
                    disabled={isInteractionDisabled}
                  />
                );
              }

              return null;
            });
          })}

          <div className="flex flex-row justify-end">
            <button
              ref={submitButtonRef}
              onClick={() => handleSubmit("manual")}
              disabled={isInteractionDisabled}
              className={`px-4 h-10 flex items-center justify-center rounded-[8px] text-[14px] font-[500] leading-[16px] tracking-[-0.02em] ${isInteractionDisabled ? "bg-[#747775]" : "bg-[#49734F]"} text-[#FFFFFF]`}
            >
              <ButtonLoader show={isInteractionDisabled} w="w-4" h="h-4" mr="mr-2" />
              {isInteractionDisabled ? "Submitting..." : "Submit Answer"}
              <RightArrowIconSVG />
            </button>
          </div>
        </div>
      </main>
      <CreateModal
        open={submitLoading}
        onClose={() => {}}
        maxWidthClassName="max-w-[440px]"
        panelClassName="p-6 sm:p-7"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <RotatingLines
            visible={true}
            height="48"
            width="48"
            color="#49734F"
            strokeWidth="5"
            animationDuration="0.75"
            ariaLabel="submission-loading"
          />
          <div className="flex flex-col gap-2">
            <p className="font-[600] text-[24px] leading-[28px] text-[#232A25]">
              {submitReason === "timeout" ? "Time is up" : "Your answer is submitting"}
            </p>
            <p className="text-[14px] font-[400] leading-[20px] text-[#747775]">
              {submitReason === "timeout"
                ? "Time is up and your answer is submitting. Please wait a moment."
                : "Your answer is submitting. Please wait a moment."}
            </p>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
