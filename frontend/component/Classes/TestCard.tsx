"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, buttonClasses, IconButton, StatusPill } from "@/design/ui";
import useDownloadExamQuestions from "@/hooks/api/exam/useDownloadExamQuestions";
import useFormat from "@/i18n/useFormat";
import { getStoredUser } from "@/lib/authSession";
import { setNewTestCreated } from "@/lib/features/testSlice";
import { useAppDispatch } from "@/lib/hooks";
import {
  getTestAudienceLabel,
  getTestCategory,
  getTestCounts,
  getTestScheduleRange,
  getTestSubjectLabel,
  isTeacherExamListItem,
} from "@/utils/tests/testListItem";
import CalenderIconSVG from "../svg/CalenderIconSVG";
import DownloadIconSVG from "../svg/DownloadIconSVG";
import PlayIconSVG from "../svg/PlayIconSVG";
import ShareIconSVG from "../svg/ShareIconSVG";

const STATUS_TONE = { ongoing: "success", pending: "info", completed: "neutral" } as const;

/** A test in a list: status, subject, participation, schedule, and the next action for this role. */
const TestCard = ({ from = "", testData, role = "TEACHER" }: { from?: string; testData: TestListItem; role?: RoleUserType }) => {
  const t = useTranslations("tests");
  const format = useFormat();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { download, loading: downloading } = useDownloadExamQuestions();
  // When the card was first shown; decides whether a student may download the paper yet.
  const [renderedAt] = useState(() => Date.now());

  const category = getTestCategory(testData);
  const { participantCount, submittedCount } = getTestCounts(testData);
  const { startAt, endAt } = getTestScheduleRange(testData);
  const isStudent = role === "STUDENT";
  const isTeacher = role === "TEACHER";
  const status = testData.status;
  const currentUserId = getStoredUser()?.id;
  const canGrade = isTeacher && isTeacherExamListItem(testData) && Boolean(currentUserId) && testData.created_by === currentUserId;
  const canStudentDownload = Boolean(endAt && renderedAt > new Date(endAt).getTime());
  const showDownload = isTeacher || (isStudent && canStudentDownload);
  const progress = participantCount > 0 ? Math.round((submittedCount / participantCount) * 100) : 0;
  const isDisabled = isTeacher && "is_active" in testData && testData.is_active === 0;

  const startTest = () => {
    sessionStorage.setItem("testId", testData.id);
    router.push("/test/permissions");
  };

  const primaryHref = isTeacher ? `/tests/${testData.id}` : status === "completed" ? `/tests/${testData.id}/results` : null;
  const primaryLabel = !isTeacher && status === "completed" ? t("card.results") : t("card.details");

  const facts = [
    ...(from === "testList" ? [{ key: "audience", label: t("card.audience"), value: getTestAudienceLabel(testData) }] : []),
    { key: "subject", label: category === "ielts" ? t("card.modules") : t("card.subject"), value: getTestSubjectLabel(testData) },
    { key: "participants", label: t("card.participants"), value: format.number(participantCount) },
    { key: "submitted", label: t("card.submitted"), value: format.number(submittedCount) },
  ];

  return (
    <article className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4 shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-title-sm font-semibold text-ink">{testData.test_name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {category ? <Badge tone="primary">{t(`category.${category}`)}</Badge> : null}
          {isTeacher && "is_active" in testData ? (
            <Badge tone={isDisabled ? "danger" : "neutral"}>{isDisabled ? t("disabled") : t("enabled")}</Badge>
          ) : null}
          <StatusPill tone={STATUS_TONE[status]}>{t(`status.${status}`)}</StatusPill>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.key} className="min-w-0">
            <dt className="text-caption text-ink-muted">{fact.label}</dt>
            <dd className="truncate text-body font-semibold text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-caption text-ink-muted">
          <span>{t("card.progress")}</span>
          <span>{t("card.progressValue", { submitted: submittedCount, total: participantCount })}</span>
        </div>
        <div
          role="progressbar"
          aria-label={t("card.progress")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 overflow-hidden rounded-full bg-canvas"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body-sm text-ink">
          <CalenderIconSVG />
          {startAt && endAt ? `${format.dateTime(startAt)} – ${format.dateTime(endAt)}` : t("card.noSchedule")}
        </p>
        <div className="flex items-center gap-1">
          {from === "testList" && isTeacher && isTeacherExamListItem(testData) ? (
            <IconButton
              size="sm"
              label={t("card.share")}
              icon={<ShareIconSVG width={16} />}
              onClick={() => dispatch(setNewTestCreated({ type: "existing", test: testData }))}
            />
          ) : null}
          {showDownload ? (
            <IconButton
              size="sm"
              label={t("card.download")}
              icon={<DownloadIconSVG width={16} />}
              disabled={downloading}
              onClick={() => void download(testData.id, testData.test_name)}
            />
          ) : null}
          {canGrade ? (
            <NextLink href={`/grading/details/${testData.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              {t("card.grade")}
            </NextLink>
          ) : null}
          {isStudent && status === "ongoing" ? (
            <Button size="sm" leftIcon={<PlayIconSVG className="size-4" />} onClick={startTest}>
              {t("card.start")}
            </Button>
          ) : primaryHref ? (
            <NextLink href={primaryHref} className={buttonClasses({ size: "sm" })}>
              {primaryLabel}
            </NextLink>
          ) : null}
        </div>
      </footer>
    </article>
  );
};

export default TestCard;
