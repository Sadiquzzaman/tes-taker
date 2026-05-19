import WelcomeBack from "./welcomeBack";
import TestTakerLogoMarkSVG from "../svg/TestTakerLogoMarkSVG";

const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className=" min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex w-full h-[100vh] bg-white overflow-hidden">
        <WelcomeBack />
        <div className="w-full md:w-1/2 h-[100vh] overflow-auto">
          <div className="flex flex-col min-h-full justify-center">
            <div className="w-full lg:w-4/5 xl:w-3/5 p-12 flex flex-col justify-center align-items-center mx-auto">
              <div className="flex items-center justify-center mb-12">
                <TestTakerLogoMarkSVG width={28} />
                <p className="text-2xl font-bold text-[#49734F] ml-2" style={{ fontFamily: "Public Sans" }}>
                  Test<span className="text-[#232A25]">Taker</span>
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
