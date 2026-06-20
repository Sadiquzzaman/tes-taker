"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ExamHeader from "@/component/Tests/exam/ExamHeader";
import ProctoringPanel from "@/component/Tests/exam/ProctoringPanel";
import StudentExamMain from "@/component/Tests/exam/StudentExamMain";
import useStartStudentExam from "@/hooks/api/exam/useStartStudentExam";
import useStudentExam from "@/hooks/api/exam/useStudentExam";
import useSubmitAnswersheet from "@/hooks/api/tests/useSubmitAnswersheet";
import useProctoring from "@/hooks/tests/proctoring/useProctoring";
import useProctoringSocket from "@/hooks/tests/proctoring/useProctoringSocket";
import {
  initializeExamAnswers,
  resetExamAnswers,
  selectExamAnswerState,
  setExamAnswerValue,
} from "@/lib/features/studentExamAnswerSlice";
import { selectIsProctoringReady } from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { createInitialExamAnswerState } from "@/utils/tests/studentExamAnswers";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RotatingLines } from "react-loader-spinner";

const getStoredTestId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem("testId");
};

const getStoredUserId = () => {
  const user = localStorage.getItem("user");

  if (!user) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(user) as User;
    return parsedUser.id;
  } catch {
    return null;
  }
};

export default function ParticipateTest() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const isProctoringReady = useAppSelector(selectIsProctoringReady);
  const proctoringState = useAppSelector((state) => state.proctoring);
  const answerState = useAppSelector(selectExamAnswerState);

  const [testId] = useState<string | null>(getStoredTestId);
  const [hasStartedExam, setHasStartedExam] = useState(false);
  const [hasAttemptedStart, setHasAttemptedStart] = useState(false);
  const [submitReason, setSubmitReason] = useState<"manual" | "timeout" | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const [startStudentExam, { loading: startLoading }] = useStartStudentExam();
  const [submitAnswersheet, { loading: submitLoading }] = useSubmitAnswersheet();
  const isExamPageReady = Boolean(testId);

  const {
    examData: test,
    loading: testLoading,
    apiComplete,
  } = useStudentExam({
    enabled: isProctoringReady && hasStartedExam && Boolean(testId),
    examId: testId,
  });
  const { videoRef, retryProctoringSetup } = useProctoring({
    isExamReady: isExamPageReady,
    allowScreenShare: test?.formState.allowScreenShare,
    screenShareDisqualifySeconds: test?.formState.screenShareDisqualifySeconds,
  });
  const { connectToSocket, emitExamSubmit, connectionError } = useProctoringSocket({
    answerSheet: answerState,
    examId: test?.id,
    flags: proctoringState.flags,
    isEnabled: isProctoringReady && hasStartedExam && Boolean(test?.id),
    totalFlagPoints: proctoringState.totalPenaltyPoints,
  });
  
  const isInteractionDisabled = startLoading || testLoading || submitLoading;

  useEffect(() => {
    if (!testId) {
      router.push("/");
    }
  }, [router, testId]);

  useEffect(() => {
    if (!testId || !isProctoringReady || hasAttemptedStart) {
      return;
    }

    const startExamSession = async () => {
      setHasAttemptedStart(true);

      const response = await startStudentExam({
        examId: testId,
        payload: {
          user_agent: navigator.userAgent,
        },
      });

      if (response?.status === 201) {
        setHasStartedExam(true);
      }
    };

    void startExamSession();
  }, [hasAttemptedStart, isProctoringReady, startStudentExam, testId]);

  useEffect(() => {
    if (!test) {
      return;
    }

    dispatch(
      initializeExamAnswers({
        examId: test.id,
        values: createInitialExamAnswerState(test),
      }),
    );
  }, [dispatch, test]);

  useEffect(() => {
    return () => {
      dispatch(resetExamAnswers());
    };
  }, [dispatch]);

  const handleSubmit = async (reason: "manual" | "timeout" = "manual") => {
    if (!isProctoringReady || !test?.id) {
      return;
    }

    const studentId = getStoredUserId();

    if (!studentId) {
      router.push("/login");
      return;
    }

    setSubmitReason(reason);
    emitExamSubmit();

    await submitAnswersheet({
      examId: test.id,
      payload: {
        studentId,
        answersheet: answerState,
      },
    });
  };

  const proctoringPanel = (
    <ProctoringPanel videoRef={videoRef} onRetry={retryProctoringSetup} connectionError={connectionError} />
  );

  if (!isProctoringReady) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <ExamHeader />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[920px] px-4 py-8">
            <div className="rounded-[8px] border border-[#DDE5DE] bg-[#F8FBF8] p-4 text-[14px] leading-5 text-[#49734F]">
              Webcam and microphone access are required before loading the test.
            </div>
          </div>
        </main>
        {proctoringPanel}
      </div>
    );
  }

  if (startLoading || (hasStartedExam && testLoading)) {
    return (
      <div>
        <div className="flex min-h-[calc(100vh-300px)] w-full items-center justify-center">
          <RotatingLines
            visible={true}
            height="48"
            width="48"
            color="grey"
            strokeWidth="5"
            animationDuration="0.75"
            ariaLabel="exam-loading"
          />
        </div>
        {proctoringPanel}
      </div>
    );
  }

  if (hasAttemptedStart && !hasStartedExam && !startLoading) {
    return (
      <div>
        <ExamHeader />
        <div className="flex min-h-[calc(100vh-162px)] items-center justify-center">
          <p className="text-[24px] font-[600] leading-8 tracking-[-0.04em] text-[#232A25]">
            Unable to start the test.
          </p>
        </div>
        {proctoringPanel}
      </div>
    );
  }

  if (!apiComplete) {
    return <div>{proctoringPanel}</div>;
  }

  if (!test) {
    return (
      <div>
        <div className="flex min-h-[calc(100vh-162px)] items-center justify-center">
          <p className="text-[24px] font-[600] leading-8 tracking-[-0.04em] text-[#232A25]">Unable to load the test.</p>
        </div>
        {proctoringPanel}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ExamHeader />
      <StudentExamMain
        exam={test}
        answerState={answerState}
        isInteractionDisabled={isInteractionDisabled}
        isSubmitLoading={submitLoading}
        submitButtonRef={submitButtonRef}
        onAnswerChange={(questionId, value) => dispatch(setExamAnswerValue({ questionId, value }))}
        onMatchingChange={(questionId, value) => dispatch(setExamAnswerValue({ questionId, value }))}
        onSubmit={() => void handleSubmit("manual")}
        onCountdownStart={connectToSocket}
        onTimeUp={() => void handleSubmit("timeout")}
      />
      {proctoringPanel}
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
            <p className="text-[24px] font-[600] leading-7 text-[#232A25]">
              {submitReason === "timeout" ? "Time is up" : "Your answer is submitting"}
            </p>
            <p className="text-[14px] leading-5 text-[#747775]">
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
