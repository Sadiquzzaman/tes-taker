import Header from "../Dashboard/Header";
import Sidebar from "../Dashboard/Sidebar";
import WorkspaceClientProvider from "./WorkspaceClientProvider";

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
      <div className="flex h-[100dvh] flex-row overflow-hidden bg-[#EFF0F3]">
        <Sidebar activeRoute={route} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <Header activeRoute={route} subText={subText} />
          <main className="h-[calc(100dvh-72px)] min-w-0 overflow-y-auto overflow-x-hidden bg-white px-4 py-2 sm:px-8 sm:py-3">
            {children}
          </main>
        </div>
      </div>
    </WorkspaceClientProvider>
  );
};

export default PageLayout;
