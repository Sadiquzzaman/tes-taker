"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusPill,
  Table,
  type TableColumn,
} from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import AdminSearchForm from "./AdminSearchForm";

const PAGE_LIMIT = 20;
const STATUSES: OrganizationStatus[] = ["pending", "approved", "rejected"];
const TONE = { pending: "warning", approved: "success", rejected: "danger", inactive: "neutral" } as const;

/** Organisation registrations: approve them, or reject with an optional reason. */
const AdminOrganizationsTable = () => {
  const t = useTranslations("admin");
  const tOrg = useTranslations("organization");
  const tUi = useTranslations("ui");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [organizations, setOrganizations] = useState<AdminOrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [acting, setActing] = useState(false);
  const [approving, setApproving] = useState<AdminOrganizationItem | null>(null);
  const [rejecting, setRejecting] = useState<AdminOrganizationItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminOrganizationsListResponse>(`${baseUrl}/organizations/admin`, {
        params: { page: currentPage, limit: PAGE_LIMIT, search: search.trim() || undefined, status: statusFilter || undefined },
      });
      setOrganizations(res.data?.payload ?? []);
      setTotalPages(Math.max(res.data?.meta?.total_pages ?? 1, 1));
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, currentPage, handleError, search, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (!approving) return;
    setActing(true);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/admin/${approving.id}/approve`, {});
      triggerToast({ title: t("organizations.approvedTitle"), description: t("organizations.approved"), type: "success" });
      setApproving(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setActing(true);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/admin/${rejecting.id}/reject`, { rejected_reason: rejectReason.trim() || undefined });
      triggerToast({ title: t("organizations.rejectedTitle"), description: t("organizations.rejected"), type: "success" });
      setRejecting(null);
      setRejectReason("");
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActing(false);
    }
  };

  const columns: TableColumn<AdminOrganizationItem>[] = [
    { key: "name", header: t("organizations.organization"), cell: (row) => row.name || "—" },
    {
      key: "number",
      header: t("organizations.number"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.public_id || "—"}</span>
          {row.organization_number ? <span className="text-caption text-ink-muted">{row.organization_number}</span> : null}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "owner",
      header: t("organizations.owner"),
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.owner?.full_name || "—"}</span>
          {row.owner?.email || row.owner?.phone ? <span className="text-caption text-ink-muted">{row.owner?.email || row.owner?.phone}</span> : null}
        </span>
      ),
    },
    { key: "date", header: t("common.requestDate"), cell: (row) => (row.created_at ? format.date(row.created_at) : "—"), hideOnMobile: true },
    { key: "status", header: t("common.status"), cell: (row) => <StatusPill tone={TONE[row.status]}>{tOrg(`statuses.${row.status}`)}</StatusPill> },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) =>
        row.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setApproving(row)}>
              {t("common.approve")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="text-danger"
              onClick={() => {
                setRejectReason("");
                setRejecting(row);
              }}
            >
              {t("common.reject")}
            </Button>
          </div>
        ) : (
          <span className="text-body-sm text-ink-muted">{row.rejected_reason || "—"}</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("organizations.title")} description={t("organizations.intro")} />
      <AdminSearchForm
        label={t("organizations.search")}
        onSearch={(value) => {
          setCurrentPage(1);
          setSearch(value);
        }}
      >
        <Select
          label={t("common.statusFilter")}
          fieldClassName="sm:w-48"
          placeholder={false}
          value={statusFilter}
          onChange={(event) => {
            setCurrentPage(1);
            setStatusFilter(event.target.value as OrganizationStatus | "");
          }}
          options={[...STATUSES.map((status) => ({ value: status, label: tOrg(`statuses.${status}`) })), { value: "", label: t("common.allStatuses") }]}
        />
      </AdminSearchForm>
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table
            caption={t("organizations.title")}
            columns={columns}
            rows={organizations}
            getRowId={(row) => row.id}
            empty={<EmptyState title={t("organizations.empty")} />}
          />
        )}
      </Card>
      <Pagination page={currentPage} pageCount={totalPages} onPageChange={setCurrentPage} />

      <ConfirmDialog
        open={Boolean(approving)}
        title={t("organizations.approveTitle", { name: approving?.name ?? "" })}
        description={t("organizations.approveDetail")}
        confirmLabel={t("common.approve")}
        loading={acting}
        onCancel={() => setApproving(null)}
        onConfirm={() => void handleApprove()}
      />
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={t("organizations.rejectTitle", { name: rejecting?.name ?? "" })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              {tUi("cancel")}
            </Button>
            <Button variant="danger" loading={acting} onClick={() => void handleReject()}>
              {t("common.reject")}
            </Button>
          </>
        }
      >
        <Input
          label={t("organizations.reason")}
          hint={t("organizations.reasonHint")}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      </Modal>
    </div>
  );
};

export default AdminOrganizationsTable;
