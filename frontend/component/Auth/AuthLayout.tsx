import NextLink from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { focusRing } from "@/design/ui";
import LanguageSwitcher from "../Layout/LanguageSwitcher";
import InstructorLogoMarkSVG from "../svg/InstructorLogoMarkSVG";
import WelcomeBack from "./WelcomeBack";

/** Login, signup and password screens: the illustration on wide screens, the form on the right. */
const AuthLayout = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("auth");
  return (
    <div className="flex min-h-dvh bg-surface">
      <WelcomeBack />
      <main className="relative flex min-h-dvh w-full flex-col md:w-1/2">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <NextLink href="/" aria-label={t("home")} className={`flex items-center gap-2 rounded-input ${focusRing}`}>
            <InstructorLogoMarkSVG width={28} />
            <span className="text-title font-bold text-primary">Instructor</span>
          </NextLink>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-6">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-8">{children}</div>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
