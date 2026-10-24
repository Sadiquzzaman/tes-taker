import AppShell from "@/design/ui/AppShell";
import Header, { HeaderActions } from "../Dashboard/Header";
import Sidebar from "../Dashboard/Sidebar";
import SidebarLogout from "../Dashboard/SidebarLogout";
import InstructorLogoMarkSVG from "../svg/InstructorLogoMarkSVG";
import WorkspaceClientProvider from "./WorkspaceClientProvider";

const Brand = () => (
  <span className="flex items-center gap-2 text-primary">
    <InstructorLogoMarkSVG width={21} />
    <span className="text-title-sm font-bold">Instructor</span>
  </span>
);

/** Every signed-in page: AppShell with the role's sidebar, the top bar, and padded page content. */
const PageLayout = ({
  children,
  route = "",
  subText,
}: {
  children: React.ReactNode;
  route?: string;
  subText?: string;
}) => {
  return (
    <WorkspaceClientProvider>
      <AppShell
        brand={<Brand />}
        nav={<Sidebar activeRoute={route} />}
        navFooter={<SidebarLogout />}
        title={<Header activeRoute={route} subText={subText} />}
        actions={<HeaderActions />}
      >
        <div className="min-w-0 px-4 py-3 sm:px-8">{children}</div>
      </AppShell>
    </WorkspaceClientProvider>
  );
};

export default PageLayout;
