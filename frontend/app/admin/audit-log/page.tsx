import { getTranslations } from "next-intl/server";
import AuditLogTable from "@/component/Audit/AuditLogTable";
import PageLayout from "@/component/Layout";
import { PageHeader } from "@/design/ui";

export default async function AdminAuditLogPage() {
  const t = await getTranslations("audit");
  return (
    <PageLayout route="/admin/audit-log" subText={t("title")}>
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader title={t("title")} description={t("platformIntro")} />
        <AuditLogTable scope="platform" />
      </div>
    </PageLayout>
  );
}
