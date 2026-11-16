"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useState } from "react";
import useApiData from "@/component/Homework/useApiData";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, DatePicker, Drawer, EmptyState, ErrorState, Link, PageHeader, RadioGroup, Select, Skeleton, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import { BANDS, IELTS_MODULES } from "./bands";

/**
 * IELTS students (P10-01, IEL-02) for a centre's staff: every student (or one batch) with test
 * type, target bands and the test date; a drawer sets them.
 */
const IeltsStudents = () => {
  const t = useTranslations("ielts");
  const format = useFormat();
  const [batch, setBatch] = useState("");
  const { data: sections } = useApiData<ClassSection[]>("/sections");
  const { data: courses } = useApiData<Class[]>("/classes");
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.class_name]));
  const { data: rows, failed, reload } = useApiData<IeltsProfile[]>("/ielts/profiles", { section_id: batch || undefined });
  const [editing, setEditing] = useState<IeltsProfile | null>(null);

  const band = (value: number | null | undefined) => (value === null || value === undefined ? "—" : format.number(value, { minimumFractionDigits: 1 }));
  const columns: TableColumn<IeltsProfile>[] = [
    { key: "name", header: t("student"), cell: (r) => <span className="font-medium text-ink">{r.student.full_name}</span>, sortValue: (r) => r.student.full_name },
    { key: "batch", header: t("batch"), cell: (r) => r.student.batch ?? "—", sortValue: (r) => r.student.batch ?? "" },
    { key: "type", header: t("testType"), cell: (r) => (r.test_type ? t(`types.${r.test_type}`) : "—") },
    { key: "overall", header: t("targetOverall"), align: "right", cell: (r) => band(r.target_overall), sortValue: (r) => r.target_overall },
    {
      key: "modules",
      header: t("targetsByModule"),
      hideOnMobile: true,
      // One compact column (Listening / Reading / Writing / Speaking) keeps the table readable.
      cell: (r) => <span className="whitespace-nowrap">{IELTS_MODULES.map((m) => band(r.target_bands[m])).join(" / ")}</span>,
    },
    {
      key: "date",
      header: t("testDate"),
      cell: (r) =>
        r.test_date ? (
          <span className="flex flex-col">
            <span className="whitespace-nowrap">{format.date(`${r.test_date}T00:00:00`, { dateStyle: "medium" })}</span>
            {r.days_to_test !== null && r.days_to_test >= 0 ? <span className="whitespace-nowrap text-xs text-ink-muted">{t("daysLeft", { count: r.days_to_test })}</span> : null}
          </span>
        ) : (
          "—"
        ),
      sortValue: (r) => r.test_date,
    },
    {
      key: "edit",
      header: t("actions"),
      align: "right",
      cell: (r) => (
        <span className="flex justify-end gap-2">
          <Link href={`/ielts/progress/${r.student.id}`} aria-label={t("progressFor", { name: r.student.full_name })}>
            {t("progress")}
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setEditing(r)} aria-label={t("editFor", { name: r.student.full_name })}>
            {t("edit")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("studentsTitle")} description={t("studentsDescription")} />
      <Card>
        <Select
          label={t("batch")}
          placeholder={t("allBatches")}
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          options={(sections ?? []).map((s) => ({ value: s.id, label: `${courseName.get(s.class_id) ?? ""} ${s.name}`.trim() }))}
          fieldClassName="max-w-xs"
        />
      </Card>
      {failed !== null ? (
        <ErrorState title={failed === 403 ? t("notAvailable") : t("loadFailed")} onRetry={reload} />
      ) : !rows ? (
        <Card aria-busy="true">
          <Skeleton lines={4} />
        </Card>
      ) : (
        <Table caption={t("studentsCaption")} columns={columns} rows={rows} getRowId={(r) => r.student.id} empty={<EmptyState title={t("noStudents")} />} />
      )}
      {editing ? (
        <ProfileDrawer
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
};

/** Test type, target overall and per module, and the booked test date. */
const ProfileDrawer = ({ profile, onClose, onSaved }: { profile: IeltsProfile; onClose: () => void; onSaved: () => void }) => {
  const t = useTranslations("ielts");
  const format = useFormat();
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [testType, setTestType] = useState<IeltsTestType | "">(profile.test_type ?? "");
  const [overall, setOverall] = useState(profile.target_overall === null ? "" : String(profile.target_overall));
  const [targets, setTargets] = useState<Record<IeltsModule, string>>(
    Object.fromEntries(IELTS_MODULES.map((m) => [m, profile.target_bands[m] === undefined ? "" : String(profile.target_bands[m])])) as Record<IeltsModule, string>,
  );
  const [testDate, setTestDate] = useState(profile.test_date ?? "");
  const [busy, setBusy] = useState(false);
  const bandOptions = BANDS.map((b) => ({ value: String(b), label: format.number(b, { minimumFractionDigits: 1 }) }));

  const save = async () => {
    setBusy(true);
    try {
      await axiosReq.put(`${process.env.NEXT_PUBLIC_BASE_URL}/ielts/profiles/${profile.student.id}`, {
        test_type: testType || null,
        target_overall: overall === "" ? null : Number(overall),
        target_bands: Object.fromEntries(IELTS_MODULES.map((m) => [m, targets[m] === "" ? null : Number(targets[m])])),
        test_date: testDate || null,
      });
      triggerToast({ title: t("saved"), type: "success" });
      onSaved();
    } catch (err) {
      handleError(err as AxiosError<ApiError>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={profile.student.full_name}
      description={t("profileDescription")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <RadioGroup
          legend={t("testType")}
          name="ielts-test-type"
          inline
          value={testType}
          onChange={(value) => setTestType(value as IeltsTestType)}
          options={[
            { value: "ACADEMIC", label: t("types.ACADEMIC") },
            { value: "GENERAL", label: t("types.GENERAL") },
          ]}
        />
        <Select label={t("targetOverall")} placeholder={t("noTarget")} value={overall} onChange={(e) => setOverall(e.target.value)} options={bandOptions} />
        <div className="grid grid-cols-2 gap-3">
          {IELTS_MODULES.map((m) => (
            <Select key={m} label={t(`modules.${m}`)} placeholder={t("noTarget")} value={targets[m]} onChange={(e) => setTargets({ ...targets, [m]: e.target.value })} options={bandOptions} />
          ))}
        </div>
        <DatePicker label={t("testDate")} value={testDate} onChange={setTestDate} hint={t("testDateHint")} />
      </div>
    </Drawer>
  );
};

export default IeltsStudents;
