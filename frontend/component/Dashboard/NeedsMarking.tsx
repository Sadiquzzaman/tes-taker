"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import TodayTile from "./TodayTile";

/** Today strip: submissions waiting to be marked. Highlighted while there are any. */
const NeedsMarking = () => {
  const t = useTranslations("dashboard.today");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const count = data?.pending_grading_count ?? 0;

  return (
    <TodayTile
      label={t("needsMarking")}
      loading={loading}
      emphasis={count > 0}
      value={format.number(count)}
      detail={t("needsMarkingDetail", { count })}
      action={count > 0 ? { label: t("goToMarking"), href: "/grading" } : undefined}
    />
  );
};

export default NeedsMarking;
