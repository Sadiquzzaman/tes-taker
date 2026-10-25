"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ChevronRightIcon, cn, focusRing } from "@/design/ui";
import AuthHeading from "./AuthHeading";

const CHOICE = cn(
  "flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-primary",
  focusRing,
);

const ChoiceBody = ({ title, detail }: { title: string; detail: string }): ReactNode => (
  <>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-title-sm font-semibold text-ink">{title}</span>
      <span className="text-body-sm text-ink-muted">{detail}</span>
    </span>
    <ChevronRightIcon className="text-ink-muted" />
  </>
);

/** Signup starts with the kind of account: student, teacher, or organisation. */
const SignUpChoice = ({ onSelectStudent, onSelectTeacher }: { onSelectStudent: () => void; onSelectTeacher: () => void }) => {
  const t = useTranslations("auth.signup");

  return (
    <>
      <AuthHeading title={t("title")}>
        <p className="text-body text-ink-muted">{t("choose")}</p>
      </AuthHeading>
      <div className="flex flex-col gap-3">
        <button type="button" onClick={onSelectStudent} className={CHOICE}>
          <ChoiceBody title={t("student")} detail={t("studentDescription")} />
        </button>
        <button type="button" onClick={onSelectTeacher} className={CHOICE}>
          <ChoiceBody title={t("teacher")} detail={t("teacherDescription")} />
        </button>
        <NextLink href="/signup/organization" className={CHOICE}>
          <ChoiceBody title={t("organization")} detail={t("organizationDescription")} />
        </NextLink>
      </div>
    </>
  );
};

export default SignUpChoice;
