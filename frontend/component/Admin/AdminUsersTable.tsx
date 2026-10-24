"use client";

import { AxiosError } from "axios";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/component/Toast/ToastContext";
import { Badge, Card, EmptyState, PageHeader, Pagination, Select, Skeleton, StatusPill, Table, type TableColumn } from "@/design/ui";
import { useApiError } from "@/hooks/api/useApiError";
import useFormat from "@/i18n/useFormat";
import axiosReq from "@/lib/axios";
import AdminSearchForm from "./AdminSearchForm";

const PAGE_LIMIT = 20;

/** Every user account; students and teachers can be switched between the two roles. */
const AdminUsersTable = () => {
  const t = useTranslations("admin");
  const format = useFormat();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminUsersListResponse>(`${baseUrl}/user/admin/users`, {
        params: { page: currentPage, limit: PAGE_LIMIT, search: search.trim() || undefined },
      });
      setUsers(res.data?.payload ?? []);
      setTotalPages(Math.max(res.data?.meta?.total_pages ?? 1, 1));
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, currentPage, handleError, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRoleChange = async (user: AdminUserListItem, nextRole: "STUDENT" | "TEACHER") => {
    if (user.role === nextRole || user.role === "ADMIN" || user.role === "SUPER_ADMIN") return;
    setUpdatingUserId(user.id);
    try {
      await axiosReq.patch(`${baseUrl}/user/admin/users/${user.id}/role`, { role: nextRole });
      triggerToast({
        title: t("users.roleUpdatedTitle"),
        description: t("users.roleUpdated", { name: user.full_name || t("users.unnamed"), role: t(`roles.${nextRole}`) }),
        type: "success",
      });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const columns: TableColumn<AdminUserListItem>[] = [
    { key: "name", header: t("common.name"), cell: (row) => row.full_name || "—" },
    { key: "phone", header: t("common.phone"), cell: (row) => row.phone || "—" },
    { key: "email", header: t("common.email"), cell: (row) => row.email || "—", hideOnMobile: true },
    {
      key: "role",
      header: t("users.role"),
      cell: (row) =>
        row.role === "ADMIN" || row.role === "SUPER_ADMIN" ? (
          <Badge>{t(`roles.${row.role}`)}</Badge>
        ) : (
          <Select
            label={t("users.roleFor", { name: row.full_name || t("users.unnamed") })}
            hideLabel
            placeholder={false}
            value={row.role}
            disabled={updatingUserId === row.id}
            onChange={(event) => void handleRoleChange(row, event.target.value as "STUDENT" | "TEACHER")}
            options={[
              { value: "STUDENT", label: t("roles.STUDENT") },
              { value: "TEACHER", label: t("roles.TEACHER") },
            ]}
          />
        ),
    },
    {
      key: "status",
      header: t("common.status"),
      cell: (row) => <StatusPill tone={row.is_active === 1 ? "success" : "neutral"}>{row.is_active === 1 ? t("common.active") : t("common.inactive")}</StatusPill>,
    },
    { key: "joined", header: t("users.joined"), cell: (row) => (row.created_at ? format.date(row.created_at) : "—"), hideOnMobile: true },
  ];

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader title={t("users.title")} description={t("users.intro")} />
      <AdminSearchForm
        label={t("users.search")}
        onSearch={(value) => {
          setCurrentPage(1);
          setSearch(value);
        }}
      />
      <Card flush>
        {loading ? (
          <div className="p-4" aria-busy="true">
            <Skeleton lines={6} />
          </div>
        ) : (
          <Table caption={t("users.title")} columns={columns} rows={users} getRowId={(row) => row.id} empty={<EmptyState title={t("users.empty")} />} />
        )}
      </Card>
      <Pagination page={currentPage} pageCount={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
};

export default AdminUsersTable;
