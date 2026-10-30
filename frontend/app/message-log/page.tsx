import { getTranslations } from "next-intl/server";
import PageLayout from "@/component/Layout";
import MessageLogTable from "@/component/Notifications/MessageLogTable";
import { PageHeader } from "@/design/ui";

/** The current workspace's message log (FND-14), for its owner and admins (and a solo teacher). */
export default async function MessageLogPage() {
  const t = await getTranslations("messageLog");
  return (
    <PageLayout route="/message-log" subText={t("title")}>
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader title={t("title")} description={t("intro")} />
        <MessageLogTable />
      </div>
    </PageLayout>
  );
}
