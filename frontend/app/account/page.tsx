import PageLayout from "@/component/Layout";
import ProfileView from "@/component/Account/ProfileView";

export default function AccountPage() {
  return (
    <PageLayout route="/account" subText="Account">
      <ProfileView />
    </PageLayout>
  );
}
