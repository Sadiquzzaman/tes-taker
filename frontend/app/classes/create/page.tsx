import CreateClassForm from "@/component/Classes/CreateClassForm";
import PageLayout from "@/component/Layout";
import CloseIconSVG from "@/component/svg/CloseIconSvg";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function CreateClassesPage() {
  const cookieStore = await cookies();
  const isOrganization = cookieStore.get("session_mode")?.value === "organization";
  const backHref = isOrganization ? "/organization/classes" : "/classes";

  return (
    <PageLayout route={backHref} subText="Create class">
      <div className="w-full max-w-[800px] mx-auto py-8 flex flex-col">
        <div className="flex justify-between items-center">
          <p className={`font-[600] text-[32px] leading-[32px] tracking-[-0.04em] text-[#232A25]`}>Create Class</p>
          <Link href={backHref}>
            <CloseIconSVG />
          </Link>
        </div>
        <CreateClassForm />
      </div>
    </PageLayout>
  );
}
