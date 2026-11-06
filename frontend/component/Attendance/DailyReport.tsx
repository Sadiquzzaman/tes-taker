"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, Card, DatePicker, EmptyState, ErrorState, Select, Skeleton, type BadgeTone } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { DAILY_GROUPS, dailyGroup, type DailyGroup } from "@/utils/attendance/reports";
import PrintSheet from "./PrintSheet";
import useReport from "./useReport";

type Section = DailyAttendanceReport["sections"][number];

const GROUP_TONE: Record<DailyGroup, BadgeTone> = {
  ABSENT: "danger",
  MISSED_SOME: "warning",
  LATE: "warning",
  LEAVE: "info",
  WAITING: "neutral",
  PRESENT: "success",
};

/** "Rahim (2 missed)" in the group lists. */
const useNameOf = () => {
  const t = useTranslations("reports");
  return (student: Section["students"][number]) =>
    student.day && student.day.missed > 0 ? `${student.full_name} (${t("missedShort", { missed: student.day.missed })})` : student.full_name;
};

/** Each section's students by their day, most urgent first, with counts and names (each student in one group). */
const SectionGroups = ({ section }: { section: Section }) => {
  const t = useTranslations("reports");
  const format = useFormat();
  const nameOf = useNameOf();
  return (
    <dl className="flex flex-col gap-2">
      {DAILY_GROUPS.map((group) => {
        const names = section.students.filter((student) => dailyGroup(student.day) === group);
        const count = names.length;
        if (count === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
            <dt className="shrink-0 sm:w-44">
              <Badge tone={GROUP_TONE[group]}>
                {t(`group.${group}`)} · {format.number(count)}
              </Badge>
            </dt>
            <dd className="text-body-sm text-ink">{names.map(nameOf).join(", ")}</dd>
          </div>
        );
      })}
    </dl>
  );
};

/**
 * The daily summary per section (ATT-13): pick a date (default today) and a section (or all); each
 * section lists its classes and its students as absent (missed every class), missed some classes,
 * late, on leave, waiting or present, with counts and names. Printable.
 */
const DailyReport = ({ sections, organization }: { sections: PaperRegisterSection[]; organization: string | null }) => {
  const t = useTranslations("reports");
  const tMode = useTranslations("register.mode");
  const format = useFormat();
  const [date, setDate] = useState("");
  const [sectionId, setSectionId] = useState("");
  const { report, latest, failed, retry } = useReport<DailyAttendanceReport>("/attendance/reports/daily", {
    date: date || undefined,
    section_id: sectionId || undefined,
  });
  const shownDate = date || latest?.date || "";
  const dateName = shownDate ? format.date(`${shownDate}T00:00:00Z`, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const classLine = (section: Section) =>
    section.classes
      .map((item) => `${format.timeOfDay(item.start_time)}–${format.timeOfDay(item.end_time)}${item.cancelled ? ` (${t("cancelled")})` : ""}`)
      .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <DatePicker label={t("date")} value={shownDate} onChange={(value) => setDate(value)} fieldClassName="sm:w-48" />
        <Select
          label={t("section")}
          fieldClassName="sm:w-72"
          placeholder={false}
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          options={[{ value: "", label: t("allSections") }, ...sections.map((item) => ({ value: item.id, label: `${item.class_name} ${item.name}` }))]}
        />
        {report && report.sections.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            {t("print")}
          </Button>
        ) : null}
      </div>

      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={retry} />
      ) : !report ? (
        <div aria-busy="true">
          <Skeleton lines={5} />
        </div>
      ) : report.sections.length === 0 ? (
        <EmptyState title={report.closed ? t(`closed.${report.closed.reason}`) : t("noClassesDay")} description={t("noClassesDayHint")} />
      ) : (
        <>
          {report.closed ? <p className="text-body-sm text-ink-muted">{t(`closed.${report.closed.reason}`)}</p> : null}
          {report.sections.map((section) => (
            <Card
              key={section.section.id}
              title={`${section.section.class_name} ${section.section.name}`}
              description={`${tMode(section.mode)} · ${t("classesLine", { count: section.classes.length, times: classLine(section) })} · ${t("studentsCount", { count: section.counts.students })}`}
            >
              <SectionGroups section={section} />
            </Card>
          ))}
        </>
      )}

      {report && report.sections.length > 0 ? (
        <PrintSheet organization={organization} title={t("dailyTitle")} subtitle={dateName}>
          {report.sections.map((section) => (
            <section key={section.section.id} className="print-block mb-3">
              <h2 className="font-semibold">
                {section.section.class_name} {section.section.name} · {t("classesLine", { count: section.classes.length, times: classLine(section) })}
              </h2>
              <SectionGroups section={section} />
            </section>
          ))}
        </PrintSheet>
      ) : null}
    </div>
  );
};

export default DailyReport;
