import { getTranslations } from "next-intl/server";
import AuditLogTable from "@/component/Audit/AuditLogTable";
import PageLayout from "@/component/Layout";
import { PageHeader } from "@/design/ui";

/** The current workspace's audit log, for its owner and admins (and a solo teacher). */
export default async function ActivityLogPage() {
  const t = await getTranslations("audit");
  return (
    <PageLayout route="/activity-log" subText={t("organizationTitle")}>
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader title={t("organizationTitle")} description={t("organizationIntro")} />
        <AuditLogTable scope="organization" />
      </div>
    </PageLayout>
  );
}
