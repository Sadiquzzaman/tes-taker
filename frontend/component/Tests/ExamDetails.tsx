"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { RotatingLines } from "react-loader-spinner";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";

const formatOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const audienceLabels: Record<string, string> = {
  anyone: "Anyone with the link",
  selected_class: "Selected class",
  specific_students: "Specific students",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-US", formatOptions) : "N/A";

const countQuestions = (subjects: StudentExamSubject[]) =>
  subjects.reduce(
    (total, subject) =>
      total +
      subject.questions.reduce(
        (count, question) => count + ("childQuestions" in question ? question.childQuestions.length : 1),
        0,
      ),
    0,
  );

const sumMarks = (subjects: StudentExamSubject[]) =>
  subjects.reduce(
    (total, subject) =>
      total +
      subject.questions.reduce((marks, question) => {
        if ("childQuestions" in question) {
          return marks + question.childQuestions.reduce((childMarks, child) => childMarks + (child.points ?? 0), 0);
        }
        return marks + (question.points ?? 0);
      }, 0),
    0,
  );

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <p className="text-[14px] font-[400] leading-[16px] tracking-[-0.02em] text-[#747775]">{label}</p>
    <p className="text-[16px] font-[600] leading-[20px] tracking-[-0.02em] text-[#232A25]">{value}</p>
  </div>
);

const ExamDetails = ({ examId }: { examId: string }) => {
  const router = useRouter();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();

  const [exam, setExam] = useState<TeacherExamDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchExam = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axiosReq.get(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}`);
      setExam(response.data.payload as TeacherExamDetails);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    void fetchExam();
  }, [fetchExam]);

  const isDisabled = exam?.is_active === 0;
  const startAt = exam?.publishState?.scheduleAt ?? null;
  const endAt = exam?.publishState?.endingAt ?? null;

  const canModify = useMemo(() => {
    if (!startAt) {
      return false;
    }
    return Date.now() < new Date(startAt).getTime();
  }, [startAt]);

  const handleToggleStatus = useCallback(async () => {
    if (!exam) {
      return;
    }
    setToggling(true);
    try {
      const response = await axiosReq.patch(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}/status`, {
        active: isDisabled,
      });
      triggerToast({
        title: "Success",
        description: response.data.message || "Exam status updated.",
        type: "success",
      });
      await fetchExam();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setToggling(false);
    }
  }, [exam, examId, fetchExam, handleError, isDisabled, triggerToast]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-232px)] items-center justify-center">
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
  }

  if (!exam) {
    return (
      <div className="flex min-h-[calc(100vh-232px)] flex-col items-center justify-center gap-4">
        <p className="text-[18px] font-[600] text-[#232A25]">Test not found</p>
        <button
          type="button"
          onClick={() => router.push("/tests")}
          className="rounded-[8px] bg-[#49734F] px-4 py-2 text-[14px] font-[500] text-white"
        >
          Back to tests
        </button>
      </div>
    );
  }

  const subjectNames = exam.subjects?.map((subject) => subject.name).filter(Boolean).join(", ") || "N/A";
  const questionCount = countQuestions(exam.subjects ?? []);
  const totalMarks = sumMarks(exam.subjects ?? []);

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col gap-6 py-2">
      <div className="flex flex-col gap-4 rounded-[12px] bg-[#EFF0F3BF] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[24px] font-[600] leading-[28px] tracking-[-0.04em] text-[#232A25]">
              {exam.test_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[27px] border border-[#49734F] bg-[rgba(73,115,79,0.15)] px-2 py-1 text-[12px] font-[500] capitalize text-[#49734F]">
                {exam.status}
              </span>
              <span
                className={`rounded-[27px] border px-2 py-1 text-[12px] font-[500] ${
                  isDisabled
                    ? "border-[#B42318] bg-[#B4231815] text-[#B42318]"
                    : "border-[#49734F] bg-[rgba(73,115,79,0.15)] text-[#49734F]"
                }`}
              >
                {isDisabled ? "Disabled" : "Enabled"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Link
                href={canModify ? `/tests/create?examId=${exam.id}` : "#"}
                aria-disabled={!canModify}
                onClick={(event) => {
                  if (!canModify) {
                    event.preventDefault();
                  }
                }}
                className={`rounded-[8px] px-4 py-2 text-[14px] font-[500] transition-colors ${
                  canModify
                    ? "bg-[#49734F] text-white hover:bg-[#3f6244]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#A0A4A1]"
                }`}
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={!canModify || toggling}
                className={`rounded-[8px] border px-4 py-2 text-[14px] font-[500] transition-colors ${
                  !canModify || toggling
                    ? "cursor-not-allowed border-[#E5E5E5] bg-[#E5E5E5] text-[#A0A4A1]"
                    : isDisabled
                      ? "border-[#49734F] bg-white text-[#49734F] hover:bg-[#49734F] hover:text-white"
                      : "border-[#B42318] bg-white text-[#B42318] hover:bg-[#B42318] hover:text-white"
                }`}
              >
                {toggling ? "Saving..." : isDisabled ? "Enable" : "Disable"}
              </button>
            </div>
            {!canModify && (
              <p className="max-w-[260px] text-right text-[12px] font-[400] leading-[16px] text-[#747775]">
                This test has started or ended. It can no longer be edited or disabled.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-[12px] bg-[#EFF0F3BF] p-4 sm:grid-cols-2 sm:p-6">
        <DetailRow label="Subject(s)" value={subjectNames} />
        <DetailRow label="Audience" value={audienceLabels[exam.publishState?.testAudience] ?? "N/A"} />
        <DetailRow label="Class" value={exam.class_name ?? "N/A"} />
        <DetailRow label="Duration" value={`${exam.formState?.duration ?? 0} min`} />
        <DetailRow label="Starts" value={formatDate(startAt)} />
        <DetailRow label="Ends" value={formatDate(endAt)} />
        <DetailRow label="Questions" value={questionCount} />
        <DetailRow label="Total marks" value={totalMarks} />
        <DetailRow
          label="Passing score"
          value={exam.formState?.passingScore !== "" && exam.formState?.passingScore != null ? exam.formState.passingScore : "N/A"}
        />
        <DetailRow
          label="Negative marking"
          value={
            exam.formState?.allowNegativeMarking ? `${exam.formState?.negativeMarking ?? 0}%` : "Disabled"
          }
        />
      </div>

      <div className="flex flex-col gap-4 rounded-[12px] bg-[#EFF0F3BF] p-4 sm:p-6">
        <h2 className="text-[18px] font-[600] leading-[24px] tracking-[-0.02em] text-[#232A25]">Subjects</h2>
        <div className="flex flex-col gap-2">
          {(exam.subjects ?? []).map((subject) => (
            <div
              key={subject.id}
              className="flex items-center justify-between rounded-[8px] bg-white px-4 py-3"
            >
              <p className="text-[16px] font-[500] text-[#232A25]">{subject.name}</p>
              <p className="text-[14px] font-[400] text-[#747775]">
                {subject.questions.reduce(
                  (count, question) =>
                    count + ("childQuestions" in question ? question.childQuestions.length : 1),
                  0,
                )}{" "}
                questions
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => router.push("/tests")}
          className="text-[14px] font-[500] text-[#49734F] underline"
        >
          Back to tests
        </button>
      </div>
    </div>
  );
};

export default ExamDetails;
