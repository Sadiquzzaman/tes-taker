"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonClasses, Card } from "@/design/ui";
import useAcademicsRequest from "@/hooks/academics/useAcademicsRequest";
import axiosReq from "@/lib/axios";

/**
 * On the organisation overview (owners and admins): until the academic setup is finished, a banner
 * leads to the wizard (P2-04; banner only, no redirect). Afterwards, a small link to open it again.
 */
const SetupBanner = () => {
  const t = useTranslations("academics.setup.banner");
  const { baseUrl, run } = useAcademicsRequest();
  const [summary, setSummary] = useState<AcademicSetupSummary | null>(null);

  useEffect(() => {
    void run(() => axiosReq.get<ApiResponse<AcademicSetupSummary>>(`${baseUrl}/setup`)).then((res) => setSummary(res?.data?.payload ?? null));
  }, [baseUrl, run]);

  if (!summary) return null;

  if (summary.setup_completed_at) {
    return (
      <div className="flex justify-end">
        <NextLink href="/organization/setup" className={buttonClasses({ size: "sm", variant: "ghost" })}>
          {t("reopen")}
        </NextLink>
      </div>
    );
  }

  return (
    <Card className="border-primary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-title-sm font-semibold text-ink">{t("title")}</p>
          <p className="text-body-sm text-ink-muted">{t("detail")}</p>
        </div>
        <NextLink href="/organization/setup" className={buttonClasses({ size: "md" })}>
          {summary.classes.length > 0 ? t("continue") : t("start")}
        </NextLink>
      </div>
    </Card>
  );
};

export default SetupBanner;
