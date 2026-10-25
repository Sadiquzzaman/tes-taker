"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/design/ui";
import GoogleIconSVG from "../svg/GoogleIconSVG";

/** Sends the visitor to the backend's Google sign-in. */
const ContinueWithGoogle = () => {
  const t = useTranslations("auth");
  const handleGoogleSignIn = () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) return;
    window.location.href = `${baseUrl}/auth/google`;
  };

  return (
    <Button variant="secondary" fullWidth leftIcon={<GoogleIconSVG width={16} />} onClick={handleGoogleSignIn}>
      {t("continueWithGoogle")}
    </Button>
  );
};

export default ContinueWithGoogle;
