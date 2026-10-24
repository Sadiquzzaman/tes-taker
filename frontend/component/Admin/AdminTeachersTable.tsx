"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, EmptyState, FilterBar, PageHeader, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

type SubscriptionRow = {
  id: string;
  teacher_id?: string;
  status?: string;
  billing_cycle?: string;
  start_date?: string;
  end_date?: string;
  created_at?: string;
  teacher?: { full_name?: string; email?: string; phone?: string; is_active?: number };
  plan?: { name?: string };
};

const isTeacherActive = (value?: number) => value === 1 || value === undefined;

/** One row per teacher (their active subscription if they have one), with a way to disable their login. */
export const latestTeacherRows = (subscriptions: SubscriptionRow[]) => {
  const byTeacher = new Map<string, SubscriptionRow>();
  for (const sub of subscriptions) {
    const key = sub.teacher_id ?? sub.id;
    const existing = byTeacher.get(key);
    if (!existing || (existing.status !== "ACTIVE" && sub.status === "ACTIVE")) byTeacher.set(key, sub);
  }
  return Array.from(byTeacher.values());
};

const AdminTeachersTable = () => {
  const t = useTranslations("admin");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<SubscriptionRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get(`${baseUrl}/subscriptions/admin/all-subscriptions`);
      setSubscriptions(res.data?.payload ?? []);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = latestTeacherRows(subscriptions);
    return q ? rows.filter((row) => (row.teacher?.full_name ?? "").toLowerCase().includes(q)) : rows;
  }, [subscriptions, search]);

  const toggleTeacherStatus = async (teacherId: string, active: boolean) => {
    setTogglingId(teacherId);
    try {
      await axiosReq.patch(`${baseUrl}/subscriptions/admin/teacher/${teacherId}/status`, { active });
      triggerToast({
        title: active ? t("teachers.enabledTitle") : t("teachers.disabledTitle"),
        description: active ? t("teachers.enabled") : t("teachers.disabledDetail"),
        type: "success",
      });
      setDisabling(null);
      await loadData();
    } catch {
      triggerToast({ title: t("common.errorTitle"), description: t("teachers.failed"), type: "error" });
    } finally {
      setTogglingId(null);
    }
  };

  const columns: TableColumn<SubscriptionRow>[] = [
    { key: "teacher", header: t("teachers.teacher"), cell: (row) => row.teacher?.full_name ?? "—", sortValue: (row) => row.teacher?.full_name },
    { key: "contact", header: t("common.contact"), cell: (row) => row.teacher?.email ?? row.teacher?.phone ?? "—", hideOnMobile: true },
    { key: "plan", header: t("teachers.plan"), cell: (row) => row.plan?.name ?? "—" },
    {
      key: "status",
      header: t("common.status"),
      cell: (row) =>
        isTeacherActive(row.teacher?.is_active) ? (
          <StatusPill tone="success">{t("common.active")}</StatusPill>
        ) : (
          <StatusPill tone="danger">{t("common.disabled")}</StatusPill>
        ),
    },
    { key: "started", header: t("teachers.started"), cell: (row) => (row.start_date ?? row.created_at ? format.date(row.start_date ?? row.created_at ?? "") : "—"), hideOnMobile: true },
    { key: "ends", header: t("teachers.ends"), cell: (row) => (row.end_date ? format.date(row.end_date) : "—"), hideOnMobile: true },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) => {
        const teacherId = row.teacher_id ?? "";
        const active = isTeacherActive(row.teacher?.is_active);
        return active ? (
          <Button size="sm" variant="secondary" className="text-danger" disabled={!teacherId} onClick={() => setDisabling(row)}>
            {t("common.disable")}
          </Button>
        ) : (
          <Button size="sm" disabled={!teacherId} loading={togglingId === teacherId} onClick={() => void toggleTeacherStatus(teacherId, true)}>
            {t("common.enable")}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("teachers.title")} description={t("teachers.intro")} />
      <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("teachers.search")} />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table caption={t("teachers.title")} columns={columns} rows={filtered} getRowId={(row) => row.id} empty={<EmptyState title={t("teachers.empty")} />} />
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(disabling)}
        tone="danger"
        title={t("teachers.disableTitle", { name: disabling?.teacher?.full_name ?? "" })}
        description={t("teachers.disableDetail")}
        confirmLabel={t("common.disable")}
        loading={Boolean(togglingId)}
        onCancel={() => setDisabling(null)}
        onConfirm={() => disabling?.teacher_id && void toggleTeacherStatus(disabling.teacher_id, false)}
      />
    </div>
  );
};

export default AdminTeachersTable;
