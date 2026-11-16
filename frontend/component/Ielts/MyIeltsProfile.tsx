"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatTile } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import { IELTS_MODULES } from "./bands";

/** A student's own IELTS profile (P10-01, IEL-02): targets and the countdown to the test. */
const MyIeltsProfile = () => {
  const t = useTranslations("ielts");
  const format = useFormat();
  const { data: profile, failed, reload } = useApiData<IeltsProfile>("/ielts/profiles/me");
  const band = (value: number | null | undefined) => (value === null || value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("myTitle")} description={profile?.test_type ? t(`types.${profile.test_type}`) : undefined} />
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !profile ? (
        <Card aria-busy="true">
          <Skeleton lines={3} />
        </Card>
      ) : !profile.test_type && profile.target_overall === null && !profile.test_date ? (
        <Card>
          <EmptyState title={t("noProfile")} description={t("noProfileHint")} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label={t("targetOverall")} value={band(profile.target_overall)} />
            <StatTile label={t("testDate")} value={profile.test_date ? format.date(`${profile.test_date}T00:00:00`, { dateStyle: "medium" }) : "—"} />
            {profile.days_to_test !== null && profile.days_to_test >= 0 ? <StatTile label={t("daysToTest")} value={t("daysLeft", { count: profile.days_to_test })} /> : null}
          </div>
          <Card title={t("moduleTargets")}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("moduleTargets")}>
              {IELTS_MODULES.map((m) => (
                <li key={m} className="flex flex-col gap-1">
                  <span className="text-caption text-ink-muted">{t(`modules.${m}`)}</span>
                  <span className="text-title-sm font-semibold text-ink">{band(profile.target_bands[m])}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
};

export default MyIeltsProfile;
