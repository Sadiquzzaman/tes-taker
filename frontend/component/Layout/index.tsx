import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import AppShell from "@/design/ui/AppShell";
import { cn, focusRing } from "@/design/ui";
import type { BreadcrumbItem } from "@/design/ui";
import Header, { HeaderActions } from "../Dashboard/Header";
import Sidebar from "../Dashboard/Sidebar";
import SidebarLogout from "../Dashboard/SidebarLogout";
import InstructorLogoMarkSVG from "../svg/InstructorLogoMarkSVG";
import WorkspaceClientProvider from "./WorkspaceClientProvider";

/** The logo and name in the sidebar: back to Today, where every workspace opens. */
export const AppBrand = async () => {
  const t = await getTranslations("nav");
  return (
    <NextLink href="/today" aria-label={t("brandHome")} className={cn("flex items-center gap-2 rounded-input text-primary", focusRing)}>
      <InstructorLogoMarkSVG width={21} />
      <span className="text-title-sm font-bold">Instructor</span>
    </NextLink>
  );
};

/** Every signed-in page: AppShell with the role's sidebar, the top bar, and padded page content. */
const PageLayout = ({
  children,
  route = "",
  subText,
  crumbs,
}: {
  children: React.ReactNode;
  route?: string;
  subText?: string;
  /** On a sub-page: the pages between the menu section and this one (often none). The top bar then links back. */
  crumbs?: BreadcrumbItem[];
}) => {
  return (
    <WorkspaceClientProvider>
      <AppShell
        brand={<AppBrand />}
        nav={<Sidebar activeRoute={route} />}
        navFooter={<SidebarLogout />}
        title={<Header activeRoute={route} subText={subText} crumbs={crumbs} />}
        actions={<HeaderActions />}
      >
        <div className="min-w-0 px-4 py-3 sm:px-8">{children}</div>
      </AppShell>
    </WorkspaceClientProvider>
  );
};

export default PageLayout;
