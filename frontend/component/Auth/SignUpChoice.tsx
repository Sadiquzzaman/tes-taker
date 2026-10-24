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
        <h2 className="text-display font-semibold text-ink capitalize">
          {t("title")}
        </h2>
      </div>

      <p className="text-ink-muted text-body -mt-4">
        {t("choose")}
      </p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onSelectStudent}
          className="w-full text-left rounded-lg border border-border px-4 py-4 hover:border-primary transition"
        >
          <p className="text-title-sm font-semibold text-ink">{t("student")}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {t("studentDescription")}
          </p>
        </button>

        <button
          type="button"
          onClick={onSelectTeacher}
          className="w-full text-left rounded-lg border border-border px-4 py-4 hover:border-primary transition"
        >
          <p className="text-title-sm font-semibold text-ink">{t("teacher")}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {t("teacherDescription")}
          </p>
        </button>

        <Link
          href="/signup/organization"
          className="w-full text-left rounded-lg border border-border px-4 py-4 hover:border-primary transition"
        >
          <p className="text-title-sm font-semibold text-ink">{t("organization")}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {t("organizationDescription")}
          </p>
        </Link>
      </div>
    </div>
  );
};

export default SignUpChoice;
