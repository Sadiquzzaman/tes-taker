"use client";

import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import DailyReport from "./DailyReport";
import MonthlyReport from "./MonthlyReport";
import TeacherReport from "./TeacherReport";
import useReport from "./useReport";

/**
 * Attendance reports (ATT-13): the daily summary per section, the monthly register (print / PDF and
 * CSV for Excel) and, for owners and admins of an organisation, the teacher report (ATT-11).
 * Sections are the ones the caller may see (as on the Monthly register page). Students see their
 * own attendance on "My attendance".
 */
const ReportsPage = () => {
  const t = useTranslations("reports");
  const { activeOrganization, isIndividual, memberRole } = useWorkspace();
  const { report: sections, failed, retry } = useReport<PaperRegisterSection[]>("/attendance/register/sections");
  const organization = activeOrganization?.name ?? null;
  // A solo teacher's own workspace has no teacher attendance (P3-03).
  const managers = !isIndividual && Boolean(activeOrganization) && (memberRole === "OWNER" || memberRole === "ADMIN");

  const sectionTabs = !sections
    ? null
    : sections.length === 0
      ? [{ key: "none", label: t("tabs.daily"), content: <EmptyState title={t("noSections")} description={t("noSectionsHint")} /> }]
      : [
          { key: "daily", label: t("tabs.daily"), content: <DailyReport sections={sections} organization={organization} /> },
          { key: "monthly", label: t("tabs.monthly"), content: <MonthlyReport sections={sections} organization={organization} /> },
        ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />
      {failed ? (
        <ErrorState title={t("loadFailed")} onRetry={retry} />
      ) : !sectionTabs ? (
        <div aria-busy="true">
          <Skeleton lines={3} />
        </div>
      ) : (
        <Tabs tabs={[...sectionTabs, ...(managers ? [{ key: "teachers", label: t("tabs.teachers"), content: <TeacherReport organization={organization} /> }] : [])]} />
      )}
    </div>
  );
};

export default ReportsPage;
