import HeaderProfile from "@/component/Dashboard/HeaderProfile";
import InstructorLogoMarkSVG from "@/component/svg/InstructorLogoMarkSVG";

const ExamHeader = () => {
  return (
    <header className="border-b border-[#E5E5E5]">
      <div className="w-full md:w-[60%] mx-auto h-[72px] flex items-center justify-between gap-4">
        <div className="flex items-center justify-center">
          <InstructorLogoMarkSVG width={28} />
          <p className="text-2xl font-bold text-[#49734F] ml-2" style={{ fontFamily: "Public Sans" }}>
            Instructor
          </p>
        </div>
        <HeaderProfile />
      </div>
    </header>
  );
};

export default ExamHeader;
