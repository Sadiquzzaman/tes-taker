"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "@/context/DashboardContext";
import useFormat from "@/i18n/useFormat";
import TodayTile from "./TodayTile";

/** Today strip: the next scheduled test. */
const StartingSoon = () => {
  const t = useTranslations("dashboard");
  const format = useFormat();
  const { data, loading } = useDashboard();
  const next = data?.upcoming_tests?.[0];

  if (!next) {
    return (
      <TodayTile
        label={t("today.startingSoon")}
        loading={loading}
        detail={t("today.nothingScheduled")}
        action={{ label: t("createTest"), href: "/tests/create" }}
      />
    );
  }

  return (
    <TodayTile
      label={t("today.startingSoon")}
      loading={loading}
      value={next.test_name ?? t("untitledTest")}
      detail={`${format.dateTime(next.exam_start_time)} · ${next.class_name ?? t("noClass")}`}
      action={{ label: t("today.viewTests"), href: "/tests" }}
    />
  );
};

export default StartingSoon;
