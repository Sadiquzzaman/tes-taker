import LanguageSwitcher from "../Layout/LanguageSwitcher";
import WelcomeBack from "./WelcomeBack";
import InstructorLogoMarkSVG from "../svg/InstructorLogoMarkSVG";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="flex w-full h-[100vh] bg-surface overflow-hidden">
        <WelcomeBack />
        <div className="relative w-full md:w-1/2 h-[100vh] overflow-auto">
          <LanguageSwitcher className="absolute right-4 top-4" />
          <div className="flex flex-col min-h-full justify-center">
            <div className="w-full lg:w-4/5 xl:w-3/5 p-12 flex flex-col justify-center align-items-center mx-auto">
              <div className="flex items-center justify-center mb-12">
                <InstructorLogoMarkSVG width={28} />
                <p className="text-2xl font-bold text-primary ml-2">
                  Instructor
                </p>
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
