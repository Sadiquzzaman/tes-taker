"use client";

import { useTranslations } from "next-intl";
import GoogleIconSVG from "../svg/GoogleIconSVG";

const ContinueWithGoogle = () => {
  const t = useTranslations("auth");
  const handleGoogleSignIn = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      return;
    }
    window.location.href = `${baseUrl}/auth/google`;
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="w-full flex items-center justify-center gap-2 bg-[#EFF0F3] py-3 rounded-lg text-[#232A25] font-normal hover:bg-gray-200 transition"
    >
      <GoogleIconSVG width={16} />
      {t("continueWithGoogle")}
    </button>
  );
};

export default ContinueWithGoogle;
