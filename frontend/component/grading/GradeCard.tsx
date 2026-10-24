"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { buttonClasses, IconButton, Spinner, StatusPill } from "@/design/ui";
import useDownloadExamResults from "@/hooks/api/grading/useDownloadExamResults";
import useFormat from "@/i18n/useFormat";
import DownloadIconSVG from "../svg/DownloadIconSVG";
import RemainingIconSVG from "../svg/RemainingIconSVG";

const TONE = { NEEDS_GRADING: "warning", GRADED: "success", PUBLISHED: "primary" } as const;

/** A test to grade: its grading status, how many submitted and how many are graded. */
const GradeCard = ({ gradeItem }: GradeCardProps) => {
  const t = useTranslations("grading");
  const format = useFormat();
  const { download, loading: isDownloading } = useDownloadExamResults();
  const status = gradeItem.grading_status;
  const needsGrading = status === "NEEDS_GRADING";
  const submitted = gradeItem.submitted_count;

  const facts = [
    { key: "submissions", label: t("card.submissions"), value: `${format.number(submitted)} / ${format.number(gradeItem.total_participants)}` },
    { key: "graded", label: t("card.graded"), value: `${format.number(gradeItem.graded_count)} / ${format.number(submitted)}` },
  ];

  return (
    <article className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-body font-semibold text-ink">{gradeItem.test_name || "—"}</h2>
        <StatusPill tone={TONE[status]}>{t(`status.${status}`)}</StatusPill>
      </header>
      <dl className="grid grid-cols-2 gap-3">
        {facts.map((fact) => (
          <div key={fact.key}>
            <dt className="text-caption text-ink-muted">{fact.label}</dt>
            <dd className="text-body font-semibold text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <footer className="flex items-center justify-between gap-2 border-t border-border pt-3">
        {needsGrading ? (
          <p className="flex items-center gap-2 text-body-sm text-warning">
            <RemainingIconSVG />
            {t("card.pending", { count: gradeItem.pending_count })}
          </p>
        ) : (
          <IconButton
            size="sm"
            label={t("card.download")}
            icon={isDownloading ? <Spinner /> : <DownloadIconSVG width={16} />}
            disabled={isDownloading || submitted <= 0}
            onClick={() => void download(gradeItem.id, gradeItem.test_name || "exam-results")}
          />
        )}
        <NextLink href={`/grading/details/${gradeItem.id}`} className={buttonClasses({ size: "sm", variant: needsGrading ? "primary" : "secondary" })}>
          {needsGrading ? t("card.continue") : t("card.results")}
        </NextLink>
      </footer>
    </article>
  );
};

export default GradeCard;
