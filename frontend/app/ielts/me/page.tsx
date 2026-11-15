import PageLayout from "@/component/Layout";
import MyIeltsProfile from "@/component/Ielts/MyIeltsProfile";

export default function MyIeltsProfilePage() {
  return (
    <PageLayout route="/ielts/me">
      <MyIeltsProfile />
    </PageLayout>
  );
}
