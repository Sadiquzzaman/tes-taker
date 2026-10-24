"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import GlobeIconSVG from "@/component/svg/GlobeIconSVG";
import { useToast } from "@/component/Toast/ToastContext";
import { writeLocaleCookie } from "@/i18n/localeCookie";
import axiosReq from "@/lib/axios";
import { getStoredUser } from "@/lib/authSession";

/**
 * Switches between English and Bangla (FND-18). The choice is kept on this device (cookie) and,
 * when signed in, saved to the account so it follows the user to other devices.
 */
const LanguageSwitcher = ({ className = "" }: { className?: string }) => {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const { triggerToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const nextLocale = locale === "bn" ? "en" : "bn";

  const handleSwitch = async () => {
    writeLocaleCookie(nextLocale);
    startTransition(() => router.refresh());

    const user = getStoredUser();
    if (!user?.access_token) {
      return;
    }
    try {
      await axiosReq.patch(`${process.env.NEXT_PUBLIC_BASE_URL}/user/me/locale`, { locale: nextLocale });
      localStorage.setItem("user", JSON.stringify({ ...user, locale: nextLocale }));
    } catch {
      triggerToast({ title: t("switchTo"), description: t("saveFailed"), type: "error" });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleSwitch()}
      disabled={isPending}
      lang={nextLocale}
      aria-label={t("switchToLabel")}
      className={`flex items-center gap-1.5 rounded-input px-2 py-1 text-body-sm font-medium text-ink hover:bg-canvas disabled:opacity-60 ${className}`}
    >
      <GlobeIconSVG width={16} />
      <span>{t("switchTo")}</span>
    </button>
  );
};

export default LanguageSwitcher;
