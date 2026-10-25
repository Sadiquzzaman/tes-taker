import { getTranslations } from "next-intl/server";
import ProfileView from "@/component/Account/ProfileView";
import PageLayout from "@/component/Layout";

export default async function AccountPage() {
  const t = await getTranslations("account");
  return (
    <PageLayout route="/account" subText={t("title")}>
      <ProfileView />
    </PageLayout>
  );
}
