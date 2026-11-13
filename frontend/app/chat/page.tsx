import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import ChatPage from "@/component/Chat/ChatPage";

export default async function Chat() {
  const t = await getTranslations("chat");

  return (
    <PageLayout route="/chat" subText={t("title")}>
      <Suspense>
        <ChatPage />
      </Suspense>
    </PageLayout>
  );
}
