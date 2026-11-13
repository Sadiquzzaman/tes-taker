"use client";

import { useTranslations } from "next-intl";
import useFormat from "@/i18n/useFormat";

/**
 * One printed report card (PRF-09), in the card's own language: the school, the student, each
 * subject's score with grade and GPA, the overall result (and position when the school shows it),
 * attendance, homework on time, behaviour, strengths and weaknesses, and the teacher's and
 * principal's remarks. One A4 page; `break-after-page` puts the next card on a new page.
 */
const ReportCardSheet = ({ card }: { card: ReportCardView }) => {
  const t = useTranslations("reportCard");
  const format = useFormat();
  const { page, organization } = card.snapshot;
  const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${format.number(value)}%`);
  const gpa = (value: number | undefined) => (value === undefined ? "—" : format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-5 bg-surface p-8 text-body-sm text-ink break-after-page print:max-w-none print:p-0" aria-label={t("cardOf", { name: page.student.full_name })}>
      <header className="flex flex-col items-center gap-1 border-b border-border pb-4 text-center">
        <p className="text-title font-semibold">{organization.name}</p>
        <h1 className="text-title-sm font-semibold uppercase tracking-wide">{t("title")}</h1>
        <p className="text-ink-muted">{[page.section.session.name, page.period.term?.name ?? t("wholeSession")].join(" · ")}</p>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <dt className="text-ink-muted">{t("student")}</dt>
        <dd className="font-medium">{page.student.full_name}</dd>
        <dt className="text-ink-muted">{t("roll")}</dt>
        <dd>{page.student.roll_no ?? "—"}</dd>
        <dt className="text-ink-muted">{t("class")}</dt>
        <dd>{`${page.section.class_name} ${page.section.name}`.trim()}</dd>
        <dt className="text-ink-muted">{t("position")}</dt>
        <dd>{card.snapshot.show_position && page.position ? t("positionOf", { position: page.position, size: page.class_size }) : "—"}</dd>
      </dl>
      <table className="w-full border-collapse">
        <caption className="sr-only">{t("subjects")}</caption>
        <thead>
          <tr className="border-y border-border text-left text-caption text-ink-muted">
            <th scope="col" className="py-1.5 pr-2">
              {t("subject")}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right">
              {t("exams")}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right">
              {t("homework")}
            </th>
            <th scope="col" className="px-2 py-1.5 text-right">
              {t("score")}
            </th>
            <th scope="col" className="px-2 py-1.5 text-center">
              {t("grade")}
            </th>
            <th scope="col" className="py-1.5 pl-2 text-right">
              {t("gpa")}
            </th>
          </tr>
        </thead>
        <tbody>
          {page.subjects.map((subject) => (
            <tr key={subject.subject.id} className="border-b border-border">
              <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                {subject.subject.name}
              </th>
              <td className="px-2 py-1.5 text-right">{pct(subject.exams_pct)}</td>
              <td className="px-2 py-1.5 text-right">{pct(subject.homework_pct)}</td>
              <td className="px-2 py-1.5 text-right">{pct(subject.score_pct)}</td>
              <td className="px-2 py-1.5 text-center">{subject.grade?.grade ?? "—"}</td>
              <td className="py-1.5 pl-2 text-right">{gpa(subject.grade?.gpa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <th scope="row" className="py-2 pr-2 text-left">
              {t("overall")}
            </th>
            <td className="px-2 py-2 text-right">{pct(page.overall.exams_pct)}</td>
            <td className="px-2 py-2 text-right">{pct(page.overall.homework_pct)}</td>
            <td className="px-2 py-2 text-right">{pct(page.overall.score_pct)}</td>
            <td className="px-2 py-2 text-center">{page.overall.grade?.grade ?? "—"}</td>
            <td className="py-2 pl-2 text-right">{gpa(page.overall.grade?.gpa)}</td>
          </tr>
        </tfoot>
      </table>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <dt className="text-ink-muted">{t("attendance")}</dt>
        <dd>
          {pct(page.attendance.attendance_pct)}
          <span className="block text-caption text-ink-muted">
            {t("attendanceDays", { present: format.number(page.attendance.counts.present + page.attendance.counts.late), absent: format.number(page.attendance.counts.absent), leave: format.number(page.attendance.counts.leave) })}
          </span>
        </dd>
        <dt className="text-ink-muted">{t("behaviour")}</dt>
        <dd>{pct(page.overall.behaviour_pct)}</dd>
        <dt className="text-ink-muted">{t("onTime")}</dt>
        <dd>{pct(page.homework.on_time_pct)}</dd>
        <dt className="text-ink-muted">{t("weights")}</dt>
        <dd className="text-caption">{t("weightsValue", { exams: format.number(page.weights.exams_pct), homework: format.number(page.weights.homework_pct), attendance: format.number(page.weights.attendance_pct), behaviour: format.number(page.weights.behaviour_pct) })}</dd>
      </dl>
      <dl className="grid gap-1">
        <dt className="text-ink-muted">{t("strengths")}</dt>
        <dd>{page.strengths.length ? page.strengths.map((s) => `${s.subject.name} (${pct(s.score_pct)})`).join(", ") : "—"}</dd>
        <dt className="text-ink-muted">{t("weaknesses")}</dt>
        <dd>{page.weaknesses.length ? page.weaknesses.map((s) => `${s.subject.name} (${pct(s.score_pct)})`).join(", ") : "—"}</dd>
      </dl>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-input border border-border p-3">
          <h2 className="text-caption font-semibold text-ink-muted">{t("teacherRemark")}</h2>
          <p className="min-h-10 whitespace-pre-wrap">{card.teacher_remark ?? ""}</p>
          <p className="mt-6 border-t border-border pt-1 text-caption text-ink-muted">{t("teacherSignature")}</p>
        </div>
        <div className="flex flex-col gap-1 rounded-input border border-border p-3">
          <h2 className="text-caption font-semibold text-ink-muted">{t("principalRemark")}</h2>
          <p className="min-h-10 whitespace-pre-wrap">{card.principal_remark ?? ""}</p>
          <p className="mt-6 border-t border-border pt-1 text-caption text-ink-muted">{t("principalSignature")}</p>
        </div>
      </section>
      <footer className="text-caption text-ink-muted">
        {t("footer", { date: format.date(card.generated_at, { day: "numeric", month: "long", year: "numeric" }), version: format.number(card.version) })}
      </footer>
    </article>
  );
};

export default ReportCardSheet;
