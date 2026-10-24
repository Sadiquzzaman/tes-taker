import HeaderProfile from "@/component/Dashboard/HeaderProfile";
import InstructorLogoMarkSVG from "@/component/svg/InstructorLogoMarkSVG";

const ExamHeader = () => {
  return (
    <header className="border-b border-border">
      <div className="w-full md:w-[60%] mx-auto h-[72px] flex items-center justify-between gap-4">
        <div className="flex items-center justify-center">
          <InstructorLogoMarkSVG width={28} />
          <p className="text-2xl font-bold text-primary ml-2">
            Instructor
          </p>
        </div>
        <HeaderProfile />
      </div>
    </header>
  );
};

export default ExamHeader;
