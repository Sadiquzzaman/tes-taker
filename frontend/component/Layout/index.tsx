import Header from "../Dashboard/Header";
import NameSection from "../Dashboard/NameSection";
import Sidebar from "../Dashboard/Sidebar";

const PageLayout = ({ children, route }: { children: React.ReactNode; route: string }) => {
  return (
    <div className="flex flex-row h-screen bg-[#EFF0F3] overflow-y-auto">
      <Sidebar activeRoute={route} />
      <div className="flex-1">
        <Header activeRoute={route} />
        <main className="h-[calc(100vh-72px)] bg-white overflow-y-auto px-4 sm:px-8 py-2 sm:py-3">{children}</main>
      </div>
    </div>
  );
};

export default PageLayout;
