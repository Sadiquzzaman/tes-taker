"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { Badge, Breadcrumb, Button, buttonClasses, Card, ConfirmDialog, EmptyState, PageHeader, Skeleton, StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import { sumExamMarks } from "@/utils/exam/examMarks";
import { getStoredUser } from "@/lib/authSession";

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

const questionsIn = (subject: StudentExamSubject) =>
  subject.questions.reduce((count, question) => count + ("childQuestions" in question ? question.childQuestions.length : 1), 0);

/** A teacher's test: status, schedule, marks, subjects; edit, enable/disable and grade. */
const ExamDetails = ({ examId }: { examId: string }) => {
  const t = useTranslations("tests");
  const format = useFormat();
  const router = useRouter();
  const [confirmDisable, setConfirmDisable] = useState(false);
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
  }, [examId, handleError]);

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

  const canGradeTest = Boolean(exam?.created_by) && exam?.created_by === getStoredUser()?.id;

  const handleToggleStatus = useCallback(async () => {
    if (!exam) {
      return;
    }
    setToggling(true);
    try {
      await axiosReq.patch(`${process.env.NEXT_PUBLIC_BASE_URL}/exams/${examId}/status`, {
        active: isDisabled,
      });
      triggerToast({
        title: t("details.statusSaved"),
        type: "success",
      });
      await fetchExam();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setToggling(false);
    }
  }, [exam, examId, fetchExam, handleError, isDisabled, t, triggerToast]);

  const breadcrumb = (name?: string) => (
    <Breadcrumb items={[{ label: t("title"), href: "/tests" }, { label: name || t("details.title") }]} />
  );

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
        {breadcrumb()}
        <Card>
          <EmptyState
            title={t("details.notFound")}
            description={t("details.notFoundDetail")}
            action={<Button onClick={() => router.push("/tests")}>{t("details.back")}</Button>}
          />
        </Card>
      </div>
    );
  }

  const subjects = exam.subjects ?? [];
  const passing = exam.formState?.passingScore;
  const facts = [
    { key: "subjects", label: t("details.subjects"), value: subjects.map((subject) => subject.name).filter(Boolean).join(", ") || "—" },
    { key: "audience", label: t("details.audience"), value: exam.publishState?.testAudience ? t(`audience.${exam.publishState.testAudience}`) : "—" },
    { key: "class", label: t("details.class"), value: exam.class_name ?? "—" },
    { key: "duration", label: t("details.duration"), value: t("details.minutes", { minutes: exam.formState?.duration ?? 0 }) },
    { key: "starts", label: t("details.starts"), value: startAt ? format.dateTime(startAt) : "—" },
    { key: "ends", label: t("details.ends"), value: endAt ? format.dateTime(endAt) : "—" },
    { key: "questions", label: t("details.questions"), value: format.number(countQuestions(subjects)) },
    { key: "marks", label: t("details.totalMarks"), value: format.number(sumExamMarks(subjects)) },
    { key: "passing", label: t("details.passingScore"), value: passing !== "" && passing != null ? format.number(Number(passing)) : "—" },
    {
      key: "negative",
      label: t("details.negativeMarking"),
      value: exam.formState?.allowNegativeMarking ? `${format.number(Number(exam.formState?.negativeMarking ?? 0))}%` : t("details.off"),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-8">
      <PageHeader
        breadcrumb={breadcrumb(exam.test_name)}
        title={exam.test_name}
        description={
          <span className="mt-1 flex flex-wrap gap-1.5">
            <StatusPill tone={exam.status === "ongoing" ? "success" : exam.status === "pending" ? "info" : "neutral"}>{t(`status.${exam.status}`)}</StatusPill>
            <Badge tone={isDisabled ? "danger" : "neutral"}>{isDisabled ? t("disabled") : t("enabled")}</Badge>
          </span>
        }
        actions={
          <>
            {canGradeTest ? (
              <Link href={`/grading/details/${exam.id}`} className={buttonClasses({ variant: "secondary" })}>
                {t("card.grade")}
              </Link>
            ) : null}
            {canModify ? (
              <Link href={`/tests/create?examId=${exam.id}`} className={buttonClasses({ variant: "secondary" })}>
                {t("details.edit")}
              </Link>
            ) : null}
            {canModify ? (
              <Button
                variant={isDisabled ? "primary" : "danger"}
                loading={toggling}
                onClick={() => (isDisabled ? void handleToggleStatus() : setConfirmDisable(true))}
              >
                {isDisabled ? t("details.enable") : t("details.disable")}
              </Button>
            ) : null}
          </>
        }
      />
      {!canModify ? <p className="-mt-3 text-body-sm text-ink-muted">{t("details.locked")}</p> : null}

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.key} className="flex flex-col gap-0.5">
              <dt className="text-body-sm text-ink-muted">{fact.label}</dt>
              <dd className="text-body font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={t("details.subjects")} flush>
        <ul className="divide-y divide-border">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="text-body font-medium text-ink">{subject.name}</span>
              <span className="text-body-sm text-ink-muted">{t("details.questionCount", { count: questionsIn(subject) })}</span>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={confirmDisable}
        tone="danger"
        title={t("details.disableTitle")}
        description={t("details.disableDetail")}
        confirmLabel={t("details.disable")}
        loading={toggling}
        onCancel={() => setConfirmDisable(false)}
        onConfirm={() => {
          setConfirmDisable(false);
          void handleToggleStatus();
        }}
      />
    </div>
  );
};

export default ExamDetails;
