"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Card, EmptyState, FilterBar, PageHeader, Skeleton, StatTile, StatusPill, Table, type TableColumn } from "@/design/ui";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  billing_cycle?: string;
  transaction_id?: string;
  created_at: string;
  teacher?: { full_name?: string; email?: string };
  plan?: { name?: string };
};

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
};

/** The latest payments, with the total collected from completed ones. */
const AdminPaymentsTable = () => {
  const t = useTranslations("admin.payments");
  const tCommon = useTranslations("admin.common");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosReq
      .get(`${baseUrl}/subscriptions/admin/payments?limit=200`)
      .then((res) => setPayments(res.data?.payload ?? []))
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? payments.filter((p) => (p.teacher?.full_name ?? "").toLowerCase().includes(q)) : payments;
  }, [payments, search]);

  const totalPaid = filtered.filter((p) => p.status === "COMPLETED").reduce((sum, p) => sum + Number(p.amount), 0);
  const statusLabel = (status: string) => (status in TONE ? t(`statuses.${status as "PENDING"}`) : status);

  const columns: TableColumn<PaymentRow>[] = [
    {
      key: "teacher",
      header: t("teacher"),
      cell: (row) => (
        <span className="flex flex-col">
          <span className="text-ink">{row.teacher?.full_name ?? "—"}</span>
          {row.teacher?.email ? <span className="text-caption text-ink-muted">{row.teacher.email}</span> : null}
        </span>
      ),
      sortValue: (row) => row.teacher?.full_name,
    },
    { key: "plan", header: t("plan"), cell: (row) => row.plan?.name ?? "—", hideOnMobile: true },
    { key: "amount", header: t("amount"), cell: (row) => `৳${format.number(Number(row.amount))}`, sortValue: (row) => Number(row.amount), align: "right" },
    { key: "status", header: tCommon("status"), cell: (row) => <StatusPill tone={TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</StatusPill> },
    { key: "transaction", header: t("transaction"), cell: (row) => <span className="font-mono text-caption">{row.transaction_id ?? "—"}</span>, hideOnMobile: true },
    { key: "date", header: t("date"), cell: (row) => format.date(row.created_at), sortValue: (row) => new Date(row.created_at) },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("title")} description={t("intro")} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder={t("search")} />
        <StatTile label={`${t("collected")} · ${t("collectedHint")}`} value={`৳${format.number(totalPaid)}`} />
      </div>
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table caption={t("title")} columns={columns} rows={filtered} getRowId={(row) => row.id} empty={<EmptyState title={t("empty")} />} />
        )}
      </Card>
    </div>
  );
};

export default AdminPaymentsTable;
