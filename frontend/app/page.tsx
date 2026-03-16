import NeedsMarking from "../component/Dashboard/NeedsMarking";
import LiveTest from "../component/Dashboard/LiveTest";
import TotalStudents from "../component/Dashboard/TotalStudents";
import TopStudents from "../component/Dashboard/TopStudents";
import UpcomingTests from "../component/Dashboard/UpcomingTests";
import Calendar from "../component/Dashboard/Calendar";
import MyClasses from "../component/Dashboard/MyClasses";
import MyActivity from "../component/Dashboard/MyActivity";
import NameSection from "@/component/Dashboard/NameSection";
import PageLayout from "@/component/Layout";

export default function StartPage() {
  return (
    <PageLayout route="/">
      <NameSection />
      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 flex flex-col gap-6 min-h-[calc(100vh-162px)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          <div className="sm:col-span-2 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
            <div className="w-full">
              <NeedsMarking />
            </div>
            <div className="w-full">
              <LiveTest />
            </div>
            <div className="w-full">
              <TotalStudents />
            </div>
            <div className="w-full hidden sm:block md:hidden">
              <MyActivity />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <div className="w-full">
                <UpcomingTests />
              </div>
            </div>
            <div className="w-full">
              <MyClasses />
            </div>
            <div className="w-full hidden sm:block md:hidden">
              <Calendar />
            </div>
          </div>

          <div className="w-full sm:col-span-2 md:col-span-3 lg:col-span-1">
            <TopStudents />
          </div>
          <div className="sm:hidden md:block md:col-span-3 lg:col-span-2">
            <div className="w-full h-full">
              <Calendar />
            </div>
          </div>
          <div className=" sm:hidden md:block md:col-span-3 lg:col-span-2">
            <div className="w-full h-full">
              <MyActivity />
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
