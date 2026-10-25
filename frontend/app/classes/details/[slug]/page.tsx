import ClassDetailsComponent from "@/component/Classes/ClassDetailsComponent";
import PageLayout from "@/component/Layout";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export default async function ClassDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const cookieStore = await cookies();
  const t = await getTranslations("classes");
  const role = cookieStore.get("role")?.value as RoleUserType | undefined;
  const { slug } = await params;

  return (
    <PageLayout route="/classes" subText={t("details")}>
      <ClassDetailsComponent classId={slug} role={role} />
    </PageLayout>
  );
}
