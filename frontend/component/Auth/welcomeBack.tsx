import Image from "next/image";

const WelcomeBack = () => {
  return (
    <div className="hidden md:block md:w-1/2 relative m-4">
      <Image src={"/assets/image/frontPage.jpg"} alt="Login Illustration" fill className="object-cover rounded-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/0"></div>
      <div className="absolute top-12 left-0 text-left">
        <div className="mx-auto w-4/5">
          <div className="flex justify-between align-items-center mb-8">
            <h4 className="text-green-700 uppercase tracking-widest font-medium mb-2">Welcome Back</h4>
            <div className="flex flex-column justify-center">
              <svg width="25" height="26" viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M24.5303 6.05328C24.8232 5.76039 24.8232 5.28551 24.5303 4.99262L19.7574 0.219648C19.4645 -0.073245 18.9896 -0.073245 18.6967 0.219648C18.4038 0.512542 18.4038 0.987415 18.6967 1.28031L22.9393 5.52295L18.6967 9.76559C18.4038 10.0585 18.4038 10.5334 18.6967 10.8263C18.9896 11.1191 19.4645 11.1191 19.7574 10.8263L24.5303 6.05328ZM0 5.52295V6.27295H24V5.52295V4.77295H0V5.52295Z"
                  fill="#49734F"
                />
              </svg>
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
