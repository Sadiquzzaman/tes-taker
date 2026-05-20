import GoogleIconSVG from "../svg/GoogleIconSVG";

const ContinueWithGoogle = () => {
  return (
    <button className="w-full flex items-center justify-center gap-2 bg-[#EFF0F3] py-3 rounded-lg text-[#232A25] font-normal hover:bg-gray-200 transition">
      <GoogleIconSVG width={16} />
      Continue with Google
    </button>
  );
};

export default ContinueWithGoogle;
