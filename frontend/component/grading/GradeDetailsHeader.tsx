"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Breadcrumb, Button, ConfirmDialog, IconButton, PageHeader, Spinner, StatusPill } from "@/design/ui";
import useDownloadExamResults from "@/hooks/api/grading/useDownloadExamResults";
import usePublishGradeResults from "@/hooks/api/grading/usePublishGradeResults";
import { useAppSelector } from "@/lib/hooks";
import DownloadIconSVG from "../svg/DownloadIconSVG";

const TONE = { NEEDS_GRADING: "warning", GRADED: "success", PUBLISHED: "primary" } as const;

/** The test being graded: its status, download, and Publish results (once everything is graded). */
const GradeDetailsHeader = ({ refetchGradeDetails }: { refetchGradeDetails: () => Promise<unknown> }) => {
  const t = useTranslations("grading");
  const { exam, stats } = useAppSelector((state) => state.gradeDetails);
  const [publishGradeResults, { loading: isPublishing }] = usePublishGradeResults();
  const { download, loading: isDownloading } = useDownloadExamResults();
  const [confirmPublish, setConfirmPublish] = useState(false);
  const isPublished = exam?.grading_status === "PUBLISHED";
  const allGraded = Boolean(stats && stats.submissions > 0 && stats.submissions === stats.graded && stats.pending === 0);
  const canPublish = Boolean(exam?.id) && !isPublished && !isPublishing && allGraded;

  const publish = async () => {
    setConfirmPublish(false);
    if (!exam?.id || !canPublish) return;
    const response = await publishGradeResults({ examId: exam.id });
    if (response?.status === 201) {
      await refetchGradeDetails();
    }
  };

  return (
    <>
      <PageHeader
        breadcrumb={<Breadcrumb items={[{ label: t("title"), href: "/grading" }, { label: exam?.test_name || t("details.title") }]} />}
        title={exam?.test_name || t("details.title")}
        description={
          exam?.grading_status ? (
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill tone={TONE[exam.grading_status]}>{t(`status.${exam.grading_status}`)}</StatusPill>
              {!isPublished && !allGraded ? <span className="text-caption text-ink-muted">{t("details.publishHint")}</span> : null}
            </span>
          ) : undefined
        }
        actions={
          <>
            <IconButton
              variant="secondary"
              label={t("details.download")}
              icon={isDownloading ? <Spinner /> : <DownloadIconSVG width={16} />}
              disabled={isDownloading || !stats || stats.submissions <= 0}
              onClick={() => exam?.id && void download(exam.id, exam.test_name || "exam-results")}
            />
            <Button disabled={!canPublish} loading={isPublishing} onClick={() => setConfirmPublish(true)}>
              {isPublishing ? t("details.publishing") : isPublished ? t("details.published") : t("details.publish")}
            </Button>
          </>
        }
      />
      <ConfirmDialog
        open={confirmPublish}
        title={t("details.publishTitle")}
        description={t("details.publishDetail")}
        confirmLabel={t("details.publish")}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => void publish()}
      />
    </>
  );
};

export default GradeDetailsHeader;
