"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import useFeatureNames from "@/component/Subscription/useFeatureNames";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";

const STATUSES: FeatureRequestStatus[] = ["OPEN", "HANDLED"];

/**
 * "Request this feature" from the More features page (FND-08). Platform admins switch the feature
 * on in Admin → Organisations, or talk to the customer, then mark the request handled.
 */
const AdminFeatureRequestsTable = () => {
  const t = useTranslations("admin");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const { featureName } = useFeatureNames();
  const [requests, setRequests] = useState<FeatureRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FeatureRequestStatus | "">("OPEN");
  const [acting, setActing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<{ payload: FeatureRequestItem[] }>(`${baseUrl}/subscriptions/admin/feature-requests`, {
        params: { status: statusFilter || undefined },
      });
      setRequests(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const markHandled = async (request: FeatureRequestItem) => {
    setActing(request.id);
    try {
      await axiosReq.patch(`${baseUrl}/subscriptions/admin/feature-requests/${request.id}/handled`, {});
      triggerToast({ title: t("featureRequests.handledTitle"), description: t("featureRequests.handled"), type: "success" });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActing(null);
    }
  };

  const columns: TableColumn<FeatureRequestItem>[] = [
    {
      key: "feature",
      header: t("featureRequests.feature"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{featureName(row.feature_key)}</span>
          {row.note ? <span className="text-caption text-ink-muted">{row.note}</span> : null}
        </span>
      ),
    },
    {
      key: "organization",
      header: t("organizations.organization"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.organization?.name || "—"}</span>
          {row.organization?.kind === "SOLO" ? <span className="text-caption text-ink-muted">{t("organizationPlan.solo")}</span> : null}
        </span>
      ),
    },
    {
      key: "user",
      header: t("featureRequests.askedBy"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.user?.full_name || "—"}</span>
          {row.user?.email || row.user?.phone ? <span className="text-caption text-ink-muted">{row.user?.email || row.user?.phone}</span> : null}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "date", header: t("common.requestDate"), cell: (row) => format.date(row.created_at), hideOnMobile: true },
    {
      key: "status",
      header: t("common.status"),
      cell: (row) => (
        <StatusPill tone={row.status === "OPEN" ? "warning" : "success"}>{t(`featureRequests.statuses.${row.status}`)}</StatusPill>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) =>
        row.status === "OPEN" ? (
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" loading={acting === row.id} disabled={Boolean(acting)} onClick={() => void markHandled(row)}>
              {t("featureRequests.markHandled")}
            </Button>
          </div>
        ) : (
          <span className="text-body-sm text-ink-muted">{row.handled_at ? format.date(row.handled_at) : "—"}</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("featureRequests.title")} description={t("featureRequests.intro")} />
      <Select
        label={t("common.statusFilter")}
        fieldClassName="sm:w-48"
        placeholder={false}
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value as FeatureRequestStatus | "")}
        options={[
          ...STATUSES.map((status) => ({ value: status, label: t(`featureRequests.statuses.${status}`) })),
          { value: "", label: t("common.allStatuses") },
        ]}
      />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table
            caption={t("featureRequests.title")}
            columns={columns}
            rows={requests}
            getRowId={(row) => row.id}
            empty={<EmptyState title={t("featureRequests.empty")} />}
          />
        )}
      </Card>
    </div>
  );
};

export default AdminFeatureRequestsTable;
