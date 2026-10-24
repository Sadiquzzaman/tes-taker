"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Button, Card, ConfirmDialog, EmptyState, PageHeader, Pagination, Select, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import AdminSearchForm from "./AdminSearchForm";

const PAGE_LIMIT = 20;
const STATUSES: TeacherRequestStatus[] = ["pending", "approved", "rejected"];
const TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;

/** Students who asked to become teachers: approve or reject each request. */
const AdminTeacherRequestsTable = () => {
  const t = useTranslations("admin");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [requests, setRequests] = useState<AdminTeacherRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherRequestStatus | "">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [acting, setActing] = useState(false);
  const [review, setReview] = useState<{ item: AdminTeacherRequestItem; action: "approve" | "reject" } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminTeacherRequestsListResponse>(`${baseUrl}/teacher-requests/admin`, {
        params: { page: currentPage, limit: PAGE_LIMIT, search: search.trim() || undefined, status: statusFilter || undefined },
      });
      setRequests(res.data?.payload ?? []);
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

  const handleReview = async () => {
    if (!review) return;
    const { item, action } = review;
    setActing(true);
    try {
      await axiosReq.patch(`${baseUrl}/teacher-requests/admin/${item.id}/${action}`, {});
      triggerToast({
        title: action === "approve" ? t("teacherRequests.approvedTitle") : t("teacherRequests.rejectedTitle"),
        description: action === "approve" ? t("teacherRequests.approved") : t("teacherRequests.rejected"),
        type: "success",
      });
      setReview(null);
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActing(false);
    }
  };

  const columns: TableColumn<AdminTeacherRequestItem>[] = [
    { key: "name", header: t("common.name"), cell: (row) => row.user.full_name || "—" },
    { key: "email", header: t("common.email"), cell: (row) => row.user.email || "—", hideOnMobile: true },
    { key: "date", header: t("common.requestDate"), cell: (row) => (row.created_at ? format.date(row.created_at) : "—") },
    { key: "status", header: t("common.status"), cell: (row) => <StatusPill tone={TONE[row.status]}>{t(`teacherRequests.statuses.${row.status}`)}</StatusPill> },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      cell: (row) =>
        row.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setReview({ item: row, action: "approve" })}>
              {t("common.approve")}
            </Button>
            <Button size="sm" variant="secondary" className="text-danger" onClick={() => setReview({ item: row, action: "reject" })}>
              {t("common.reject")}
            </Button>
          </div>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
  ];

  const name = review?.item.user.full_name || review?.item.user.email || "";

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("teacherRequests.title")} description={t("teacherRequests.intro")} />
      <AdminSearchForm
        label={t("teacherRequests.search")}
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
            setStatusFilter(event.target.value as TeacherRequestStatus | "");
          }}
          options={[{ value: "", label: t("common.allStatuses") }, ...STATUSES.map((status) => ({ value: status, label: t(`teacherRequests.statuses.${status}`) }))]}
        />
      </AdminSearchForm>
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table caption={t("teacherRequests.title")} columns={columns} rows={requests} getRowId={(row) => row.id} empty={<EmptyState title={t("teacherRequests.empty")} />} />
        )}
      </Card>
      <Pagination page={currentPage} pageCount={totalPages} onPageChange={setCurrentPage} />
      <ConfirmDialog
        open={Boolean(review)}
        tone={review?.action === "reject" ? "danger" : "primary"}
        title={review?.action === "reject" ? t("teacherRequests.rejectTitle", { name }) : t("teacherRequests.approveTitle", { name })}
        description={review?.action === "reject" ? t("teacherRequests.rejectDetail") : t("teacherRequests.approveDetail")}
        confirmLabel={review?.action === "reject" ? t("common.reject") : t("common.approve")}
        loading={acting}
        onCancel={() => setReview(null)}
        onConfirm={() => void handleReview()}
      />
    </div>
  );
};

export default AdminTeacherRequestsTable;
