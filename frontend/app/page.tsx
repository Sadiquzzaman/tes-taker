import Sidebar from "../component/Dashboard/Sidebar";
import Header from "../component/Dashboard/Header";
import NeedsMarking from "../component/Dashboard/NeedsMarking";
import LiveTest from "../component/Dashboard/LiveTest";
import TotalStudents from "../component/Dashboard/TotalStudents";
import TopStudents from "../component/Dashboard/TopStudents";
import UpcomingTests from "../component/Dashboard/UpcomingTests";
import Calendar from "../component/Dashboard/Calendar";
import MyClasses from "../component/Dashboard/MyClasses";
import MyActivity from "../component/Dashboard/MyActivity";
import NameSection from "@/component/Dashboard/NameSection";

export default function StartPage() {
  return (
    <div className="flex flex-row h-screen bg-[#EFF0F3] overflow-y-auto">
      <Sidebar activeRoute="/" />
      <div className="flex-1">
        <Header activeRoute="/" />
        <main className="h-[calc(100vh-72px)] bg-white overflow-y-auto px-4 sm:px-8 py-2 sm:py-3">
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
        </main>
      </div>
    </div>
  );
}
