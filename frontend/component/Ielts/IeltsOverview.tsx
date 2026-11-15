"use client";

import { useTranslations } from "next-intl";
import useApiData from "@/component/Homework/useApiData";
import { Card, EmptyState, ErrorState, Link, PageHeader, Skeleton, StatTile, Table, type TableColumn } from "@/design/ui";
import useWorkspace from "@/hooks/organization/useWorkspace";
import useFormat from "@/i18n/useFormat";
import { IELTS_MODULES } from "./bands";

/** The IELTS overview (P10-07, IEL-01): staff see the centre, a student their own targets and next test. */
const IeltsOverview = () => {
  const { memberRole } = useWorkspace();
  return memberRole === "STUDENT" ? <StudentOverview /> : <StaffOverview />;
};

type BatchBands = IeltsStaffDashboard["batch_bands"][number];

const StaffOverview = () => {
  const t = useTranslations("ieltsOverview");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const { data, failed, reload } = useApiData<IeltsStaffDashboard>("/ielts/dashboard");
  if (failed !== null) return <ErrorState title={failed === 403 ? tt("notAvailable") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  const band = (value: number | undefined) => (value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));
  const columns: TableColumn<BatchBands>[] = [
    { key: "batch", header: t("batch"), cell: (b) => <span className="font-medium text-ink">{b.batch}</span>, sortValue: (b) => b.batch },
    ...IELTS_MODULES.map((m) => ({ key: m, header: tt(`modulesShort.${m}`), align: "right" as const, cell: (b: BatchBands) => band(b.bands[m]), sortValue: (b: BatchBands) => b.bands[m] ?? -1 })),
  ];
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("staffDescription")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label={t("batches")} value={format.number(data.batches)} />
        <StatTile label={t("students")} value={format.number(data.students)} />
        <StatTile label={t("writingWaiting")} value={format.number(data.waiting.writing)} />
        <StatTile label={t("speakingWaiting")} value={format.number(data.waiting.speaking)} />
      </div>
      {data.waiting.writing + data.waiting.speaking > 0 ? <Link href="/ielts/marking">{t("goToMarking")}</Link> : null}
      <Card title={t("upcomingTitle")} description={t("upcomingDescription")}>
        {data.upcoming.length === 0 ? (
          <EmptyState className="py-4" title={t("noUpcoming")} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {data.upcoming.map((u) => (
              <li key={u.assignment_id} className="flex flex-wrap justify-between gap-2 py-2 text-body-sm">
                <span className="font-medium text-ink">
                  {u.test_title} · {u.batch}
                </span>
                <span className="text-ink-muted">
                  {format.dateTime(u.opens_at)} – {format.dateTime(u.closes_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t("batchBandsTitle")} description={t("batchBandsDescription")}>
        <Table caption={t("batchBandsTitle")} columns={columns} rows={data.batch_bands} getRowId={(b) => b.section_id} empty={<EmptyState className="py-4" title={t("noBands")} />} />
      </Card>
    </div>
  );
};

type TargetRow = { module: IeltsModule; target: number | null; latest: number | null };

const StudentOverview = () => {
  const t = useTranslations("ieltsOverview");
  const tt = useTranslations("ieltsTests");
  const format = useFormat();
  const { data, failed, reload } = useApiData<IeltsStudentDashboard>("/ielts/dashboard/me");
  if (failed !== null) return <ErrorState title={failed === 403 ? tt("notAvailable") : t("loadFailed")} onRetry={reload} />;
  if (!data) {
    return (
      <Card aria-busy="true">
        <Skeleton lines={6} />
      </Card>
    );
  }
  const band = (value: number | null | undefined) => (value === null || value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));
  const rows: TargetRow[] = IELTS_MODULES.map((m) => ({ module: m, target: data.profile.target_bands[m] ?? data.profile.target_overall, latest: data.latest[m] ?? null }));
  const columns: TableColumn<TargetRow>[] = [
    { key: "module", header: t("module"), cell: (r) => tt(`modulesShort.${r.module}`) },
    { key: "target", header: t("target"), align: "right", cell: (r) => band(r.target) },
    { key: "latest", header: t("latest"), align: "right", cell: (r) => <strong>{band(r.latest)}</strong> },
    {
      key: "gap",
      header: t("gap"),
      align: "right",
      cell: (r) => (r.target === null || r.latest === null ? "—" : r.latest >= r.target ? t("reached") : t("toGo", { gap: format.number(r.target - r.latest, { minimumFractionDigits: 1 }) })),
    },
  ];
  const days = data.profile.days_to_test;
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("studentDescription")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label={t("targetOverall")} value={band(data.profile.target_overall)} />
        <StatTile label={t("daysToTest")} value={days === null || days < 0 ? "—" : format.number(days)} />
        <StatTile label={t("openNow")} value={format.number(data.open_now)} />
      </div>
      <Card title={t("nextTitle")}>
        {data.next ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm">
            <span className="font-medium text-ink">
              {data.next.test_title} · {tt(`purposes.${data.next.purpose}`)}
            </span>
            <span className="text-ink-muted">
              {format.dateTime(data.next.opens_at)} – {format.dateTime(data.next.closes_at)}
            </span>
            <Link href="/ielts/my">{t("goToTests")}</Link>
          </div>
        ) : (
          <EmptyState className="py-4" title={t("noNext")} />
        )}
      </Card>
      <Card title={t("targetsTitle")} actions={<Link href="/ielts/progress">{t("seeProgress")}</Link>}>
        <Table caption={t("targetsTitle")} columns={columns} rows={rows} getRowId={(r) => r.module} />
      </Card>
    </div>
  );
};

export default IeltsOverview;
