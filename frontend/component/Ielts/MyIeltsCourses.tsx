"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, Link, PageHeader, Skeleton, StatusPill } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { COURSE_STATUS_TONE } from "./IeltsCourses";

/** A student's IELTS courses (P12-05, IEL-13): dates, modules and teachers; the timetable is on the course page. */
const MyIeltsCourses = () => {
  const t = useTranslations("ieltsCourses");
  const tModules = useTranslations("ieltsTests.modulesShort");
  const format = useFormat();
  const { data: courses, failed, reload } = useApiData<IeltsCourse[]>("/ielts/courses");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("myTitle")} description={t("myIntro")} />
      {failed !== null ? (
        <ErrorState title={t("loadFailed")} onRetry={reload} />
      ) : courses === null ? (
        <Skeleton lines={4} />
      ) : courses.length === 0 ? (
        <EmptyState title={t("myEmpty")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label={t("myTitle")}>
          {courses.map((course) => (
            <li key={course.id}>
              <Card>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={`/classes/details/${course.class_id}`} className="text-title-sm font-semibold">
                      {course.title}
                    </Link>
                    <StatusPill tone={COURSE_STATUS_TONE[course.status]}>{t(`statuses.${course.status}`)}</StatusPill>
                  </div>
                  <p className="text-body-sm text-ink-muted">
                    {format.date(course.start_date)} – {format.date(course.end_date)}
                  </p>
                  <dl className="flex flex-col gap-1 text-body-sm">
                    {course.teachers.map((m) => (
                      <div key={m.module} className="flex gap-2">
                        <dt className="font-medium text-ink">{tModules(m.module)}</dt>
                        <dd className="text-ink-muted">{m.teachers.map((x) => x.full_name ?? "—").join(", ") || t("noTeacher")}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyIeltsCourses;
