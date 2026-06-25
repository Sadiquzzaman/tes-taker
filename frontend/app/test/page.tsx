"use client";

import CreateModal from "@/component/Tests/Create/CreateModal";
import ExamHeader from "@/component/Tests/exam/ExamHeader";
import ProctoringCountdownModal from "@/component/Tests/exam/ProctoringCountdownModal";
import ProctoringDisqualificationScreen from "@/component/Tests/exam/ProctoringDisqualificationScreen";
import ProctoringMobileFab from "@/component/Tests/exam/ProctoringMobileFab";
import ProctoringPanel from "@/component/Tests/exam/ProctoringPanel";
import ProctoringSidebar from "@/component/Tests/exam/ProctoringSidebar";
import ProctoringWarningModal from "@/component/Tests/exam/ProctoringWarningModal";
import ExamMessageScreen, { type ExamMessageVariant } from "@/component/Tests/exam/ExamMessageScreen";
import StudentExamMain from "@/component/Tests/exam/StudentExamMain";
import useExamEligibility from "@/hooks/api/exam/useExamEligibility";
import useStartStudentExam from "@/hooks/api/exam/useStartStudentExam";
import useStudentExam from "@/hooks/api/exam/useStudentExam";
import useSubmitAnswersheet from "@/hooks/api/tests/useSubmitAnswersheet";
import useExamFullscreen from "@/hooks/tests/proctoring/useExamFullscreen";
import useProctoring from "@/hooks/tests/proctoring/useProctoring";
import useProctoringSocket from "@/hooks/tests/proctoring/useProctoringSocket";
import {
  hydrateExamAnswers,
  resetExamAnswers,
  selectExamAnswerState,
  setExamAnswerValue,
} from "@/lib/features/studentExamAnswerSlice";
import {
  selectIsExamInteractionBlocked,
  selectIsProctoringReady,
} from "@/lib/features/proctoringSlice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PROCTORING_CONFIG } from "@/utils/tests/proctoringConfig";
import {
  clearExamPermissionsComplete,
  clearExamSession,
  getExamMediaStreams,
  isExamPermissionsComplete,
} from "@/utils/tests/examSessionMedia";
import { createInitialExamAnswerState } from "@/utils/tests/studentExamAnswers";
import {
  loadExamAnswersFromStorage,
  saveExamAnswersToStorage,
} from "@/utils/tests/examAnswerStorage";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RotatingLines } from "react-loader-spinner";

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

const isMediaStreamActive = (stream: MediaStream | null) =>
  Boolean(stream?.getTracks().some((track) => track.readyState === "live" && track.enabled));

export default function ParticipateTest() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const isProctoringReady = useAppSelector(selectIsProctoringReady);
  const isExamInteractionBlocked = useAppSelector(selectIsExamInteractionBlocked);
  const proctoringState = useAppSelector((state) => state.proctoring);
  const answerState = useAppSelector(selectExamAnswerState);

  const [isMounted, setIsMounted] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [initialMediaStream, setInitialMediaStream] = useState<MediaStream | null>(null);
  const [hasStartedExam, setHasStartedExam] = useState(false);
  const [hasAttemptedStart, setHasAttemptedStart] = useState(false);
  const [submitReason, setSubmitReason] = useState<"manual" | "timeout" | "disqualified" | null>(null);
  const [postSubmitMessage, setPostSubmitMessage] = useState<ExamMessageVariant | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasHandledDisqualificationRef = useRef(false);
  const hasFinalizedRef = useRef(false);
  const [startStudentExam, { loading: startLoading }] = useStartStudentExam();
  const [submitAnswersheet, { loading: submitLoading }] = useSubmitAnswersheet();

  const {
    loading: eligibilityLoading,
    checked: eligibilityChecked,
    eligibility,
    messageVariant: eligibilityMessageVariant,
  } = useExamEligibility(testId, isMounted && Boolean(testId));

  const isExamPageReady =
    isMounted && Boolean(testId) && isExamPermissionsComplete() && isMediaStreamActive(initialMediaStream);

  const {
    examData: test,
    loading: testLoading,
    apiComplete,
    fetch: refetchExam,
  } = useStudentExam({
    enabled: isProctoringReady && hasStartedExam && Boolean(testId),
    examId: testId,
  });

  const { videoRef, mediaStream, retryProctoringSetup, stopProctoringSession } = useProctoring({
    isExamReady: isExamPageReady,
    doubleDisplayTimeoutSeconds: PROCTORING_CONFIG.doubleDisplayTimeout,
    initialMediaStream,
    skipAutoSetup: Boolean(initialMediaStream),
  });

  const { connectToSocket, emitExamSubmit, connectionError } = useProctoringSocket({
    answerSheet: answerState,
    examId: test?.id,
    flags: proctoringState.flags,
    isEnabled: isProctoringReady && hasStartedExam && Boolean(test?.id),
    totalFlagPoints: proctoringState.totalPenaltyPoints,
  });

  const isInteractionDisabled =
    startLoading || testLoading || submitLoading || isExamInteractionBlocked || proctoringState.isDisqualified;

  const isExamActive =
    isMounted && Boolean(testId) && isProctoringReady && !proctoringState.isDisqualified && !submitLoading;

  const { needsFullscreen, restoreFullscreen } = useExamFullscreen(isExamActive);

  const handleExamSurfaceClick = () => {
    if (needsFullscreen) {
      void restoreFullscreen();
    }
  };

  useEffect(() => {
    const storedTestId = sessionStorage.getItem("testId");
    const { cameraStream } = getExamMediaStreams();

    setTestId(storedTestId);
    setInitialMediaStream(cameraStream);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!testId) {
      router.replace("/");
      return;
    }

    if (!isExamPermissionsComplete()) {
      router.replace("/test/permissions");
    }
  }, [isMounted, router, testId]);

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

    const studentId = getStoredUserId();
    const defaults = createInitialExamAnswerState(test);
    const savedValues =
      studentId && test.id ? loadExamAnswersFromStorage(test.id, studentId) ?? undefined : undefined;

    dispatch(
      hydrateExamAnswers({
        examId: test.id,
        values: defaults,
        savedValues,
      }),
    );
  }, [dispatch, test]);

  useEffect(() => {
    if (!test?.id) {
      return;
    }

    const studentId = getStoredUserId();
    if (!studentId || Object.keys(answerState).length === 0) {
      return;
    }

    saveExamAnswersToStorage(test.id, studentId, answerState);
  }, [answerState, test?.id]);

  useEffect(() => {
    return () => {
      dispatch(resetExamAnswers());
    };
  }, [dispatch]);

  const handleSubmit = async (reason: "manual" | "timeout" | "disqualified" = "manual") => {
    if (hasFinalizedRef.current || !isProctoringReady || !test?.id) {
      return;
    }

    const studentId = getStoredUserId();

    if (!studentId) {
      router.push("/login");
      return;
    }

    hasFinalizedRef.current = true;
    setSubmitReason(reason);
    emitExamSubmit();

    const response = await submitAnswersheet({
      examId: test.id,
      payload: {
        studentId,
        answersheet: answerState,
        reason,
        disqualification_reason:
          reason === "disqualified" ? proctoringState.disqualificationReason ?? undefined : undefined,
      },
      onSuccess: (submitReasonValue) => {
        stopProctoringSession();
        void clearExamSession();

        if (submitReasonValue === "manual") {
          router.push("/");
          return;
        }

        setPostSubmitMessage(submitReasonValue === "timeout" ? "time-up" : "disqualified");
      },
    });

    if (!response) {
      hasFinalizedRef.current = false;
      stopProctoringSession();
    }
  };

  useEffect(() => {
    if (!proctoringState.isDisqualified || hasHandledDisqualificationRef.current || !test?.id) {
      return;
    }

    hasHandledDisqualificationRef.current = true;
    void handleSubmit("disqualified");
  }, [proctoringState.isDisqualified, test?.id]);

  if (!isMounted || !testId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="#49734F"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="exam-loading"
        />
      </div>
    );
  }

  if (eligibilityLoading || !eligibilityChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RotatingLines
          visible={true}
          height="48"
          width="48"
          color="#49734F"
          strokeWidth="5"
          animationDuration="0.75"
          ariaLabel="eligibility-loading"
        />
      </div>
    );
  }

  if (eligibilityMessageVariant) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <ExamHeader />
        <ExamMessageScreen variant={eligibilityMessageVariant} reason={eligibility?.reason} />
      </div>
    );
  }

  if (postSubmitMessage) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <ExamHeader />
        <ExamMessageScreen
          variant={postSubmitMessage}
          reason={proctoringState.disqualificationReason}
          onAction={() => router.push("/classes")}
        />
      </div>
    );
  }

  const proctoringOverlays = (
    <>
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        aria-hidden
      />
      <ProctoringPanel mediaStream={mediaStream} onRetry={retryProctoringSetup} connectionError={connectionError} />
      <ProctoringSidebar mediaStream={mediaStream} />
      <ProctoringMobileFab mediaStream={mediaStream} />
      <ProctoringWarningModal />
      <ProctoringCountdownModal />
      <ProctoringDisqualificationScreen
        open={proctoringState.isDisqualified}
        reason={proctoringState.disqualificationReason}
      />
    </>
  );

  if (!isMediaStreamActive(initialMediaStream)) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <ExamHeader />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[920px] px-4 py-8">
            <div className="rounded-[8px] border border-[#DDE5DE] bg-[#F8FBF8] p-4 text-[14px] leading-5 text-[#49734F]">
              Camera and microphone access were lost. Please return to permissions and try again.
            </div>
            <button
              type="button"
              onClick={() => {
                clearExamPermissionsComplete();
                router.replace("/test/permissions");
              }}
              className="mt-4 h-11 rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
            >
              Back to Permissions
            </button>
          </div>
        </main>
        {proctoringOverlays}
      </div>
    );
  }

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
        {proctoringOverlays}
      </div>
    );
  }

  if (startLoading || (hasStartedExam && testLoading)) {
    return (
      <div>
        <ExamHeader />
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
        {proctoringOverlays}
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
        {proctoringOverlays}
      </div>
    );
  }

  if (!apiComplete) {
    return (
      <div>
        <ExamHeader />
        <div className="flex min-h-[calc(100vh-300px)] w-full items-center justify-center">
          <RotatingLines
            visible={true}
            height="48"
            width="48"
            color="#49734F"
            strokeWidth="5"
            animationDuration="0.75"
            ariaLabel="exam-loading"
          />
        </div>
        {proctoringOverlays}
      </div>
    );
  }

  if (!test) {
    return (
      <div>
        <ExamHeader />
        <div className="flex min-h-[calc(100vh-162px)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-[24px] font-[600] leading-8 tracking-[-0.04em] text-[#232A25]">Unable to load the test.</p>
          <button
            type="button"
            onClick={() => void refetchExam(testId)}
            className="h-11 rounded-[10px] bg-[#49734F] px-5 text-[14px] font-[600] leading-4 text-white"
          >
            Retry
          </button>
        </div>
        {proctoringOverlays}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" onClick={handleExamSurfaceClick}>
      {needsFullscreen ? (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex justify-center px-4">
          <div className="rounded-[10px] border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-[13px] leading-5 text-[#B54708] shadow-md">
            Click anywhere on the exam page to return to fullscreen.
          </div>
        </div>
      ) : null}
      <ExamHeader />
      <div className="flex min-h-0 flex-1">
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
        <ProctoringSidebar mediaStream={mediaStream} />
      </div>
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        aria-hidden
      />
      <ProctoringPanel mediaStream={mediaStream} onRetry={retryProctoringSetup} connectionError={connectionError} />
      <ProctoringMobileFab mediaStream={mediaStream} />
      <ProctoringWarningModal />
      <ProctoringCountdownModal />
      <ProctoringDisqualificationScreen
        open={proctoringState.isDisqualified}
        reason={proctoringState.disqualificationReason}
      />
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
              {submitReason === "timeout"
                ? "Time is up"
                : submitReason === "disqualified"
                  ? "Exam ended"
                  : "Your answer is submitting"}
            </p>
            <p className="text-[14px] leading-5 text-[#747775]">
              {submitReason === "timeout"
                ? "Time is up and your answer is submitting. Please wait a moment."
                : submitReason === "disqualified"
                  ? "Your session was disqualified and your answers are being submitted."
                  : "Your answer is submitting. Please wait a moment."}
            </p>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}
