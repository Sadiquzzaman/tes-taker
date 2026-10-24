"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

const SignUpChoice = ({
  onSelectStudent,
  onSelectTeacher,
}: {
  onSelectStudent: () => void;
  onSelectTeacher: () => void;
}) => {
  const t = useTranslations("auth.signup");

  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-8">
      <div className="flex flex-row justify-between items-center mb-2">
        <h2 className="text-[32px] font-semibold text-[#0F1A12] leading-[39px] tracking-[-0.02em] capitalize">
          {t("title")}
        </h2>
      </div>

      <p className="text-[#747775] text-[16px] leading-[20px] -mt-4">
        {t("choose")}
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectStudent}
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">{t("student")}</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            {t("studentDescription")}
          </p>
        </button>

        <button
          type="button"
          onClick={onSelectTeacher}
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">{t("teacher")}</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            {t("teacherDescription")}
          </p>
        </button>

        <Link
          href="/signup/organization"
          className="w-full text-left rounded-lg border border-[#E5E5E5] px-4 py-4 hover:border-[#49734F] transition"
        >
          <p className="text-[18px] font-semibold text-[#232A25]">{t("organization")}</p>
          <p className="mt-1 text-[14px] text-[#747775]">
            {t("organizationDescription")}
          </p>
        </Link>
      </div>
    </div>
  );
};

export default SignUpChoice;
