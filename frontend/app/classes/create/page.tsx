import CreateClassForm from "@/component/Classes/CreateClassForm";
import PageLayout from "@/component/Layout";
import { Breadcrumb, PageHeader } from "@/design/ui";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";

export default async function CreateClassesPage() {
  const cookieStore = await cookies();
  const t = await getTranslations("classes");
  const isOrganization = cookieStore.get("session_mode")?.value === "organization";
  const backHref = isOrganization ? "/organization/classes" : "/classes";

  return (
    <PageLayout route={backHref} subText={t("form.title")}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
        <PageHeader breadcrumb={<Breadcrumb items={[{ label: t("title"), href: backHref }, { label: t("form.title") }]} />} title={t("form.title")} />
        <CreateClassForm />
      </div>
    </PageLayout>
  );
}
