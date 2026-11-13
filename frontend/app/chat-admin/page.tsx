import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import ChatReview from "@/component/Chat/ChatReview";

export default async function ChatReviewPage() {
  const t = await getTranslations("chatReview");

  return (
    <PageLayout route="/chat-admin" subText={t("title")}>
      <Suspense>
        <ChatReview />
      </Suspense>
    </PageLayout>
  );
}
