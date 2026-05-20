import Image from "next/image";
import WelcomeArrowIconSVG from "../svg/WelcomeArrowIconSVG";

const WelcomeBack = () => {
  return (
    <div className="hidden md:block md:w-1/2 relative m-4">
      <Image src={"/assets/image/frontPage.jpg"} alt="Login Illustration" fill className="object-cover rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/0"></div>
      <div className="absolute top-12 left-0 text-left">
        <div className="mx-auto w-4/5">
          <div className="flex justify-between align-items-center mb-8">
            <h4 className="text-green-700 uppercase tracking-widest font-medium mb-2">Welcome Back</h4>
            <div className="flex flex-column justify-center text-[#49734F]">
              <WelcomeArrowIconSVG width={25} />
            </div>
          </div>
          <h1 className="text-[32px] font-medium text-[#232A25]">
            Manage classes, create tests, and review results the{" "}
            <span className="text-[#49734F]">most convenient way</span>
          </h1>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBack;
