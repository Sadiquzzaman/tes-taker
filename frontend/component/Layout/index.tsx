import Header from "../Dashboard/Header";
import Sidebar from "../Dashboard/Sidebar";

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
    <div className="flex h-[100dvh] flex-row overflow-y-auto bg-[#EFF0F3]">
      <Sidebar activeRoute={route} />
      <div className="flex-1">
        <Header activeRoute={route} subText={subText} />
        <main className="h-[calc(100dvh-72px)] overflow-y-auto bg-white px-4 py-2 sm:px-8 sm:py-3">{children}</main>
      </div>
    </div>
  );
};

export default PageLayout;
