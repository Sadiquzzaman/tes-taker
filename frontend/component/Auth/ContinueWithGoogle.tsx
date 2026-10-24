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
      className="w-full flex items-center justify-center gap-2 bg-canvas py-3 rounded-lg text-ink font-normal hover:bg-border transition"
    >
      <GoogleIconSVG width={16} />
      {t("continueWithGoogle")}
    </button>
  );
};

export default ContinueWithGoogle;
