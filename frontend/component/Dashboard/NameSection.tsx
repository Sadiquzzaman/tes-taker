"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/design/ui";
import CreateTestActionButton from "@/component/Tests/CreateTestActionButton";
import { useNameSection } from "@/hooks/Dashboard/useNameSection";

/** The dashboard's page header: a welcome with the user's name, and Create test for teachers. */
const NameSection = ({ variant = "teacher" }: { variant?: "teacher" | "student" }) => {
  const t = useTranslations("dashboard");
  const { fullName } = useNameSection();
  const isStudent = variant === "student";

  return (
    <PageHeader
      title={fullName ? t("welcome", { name: fullName }) : t("welcomeFallback")}
      description={isStudent ? t("student.intro") : t("teacherIntro")}
      actions={isStudent ? undefined : <CreateTestActionButton />}
    />
  );
};

export default NameSection;
