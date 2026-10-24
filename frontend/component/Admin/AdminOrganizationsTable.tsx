"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";

const PAGE_LIMIT = 20;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const statusStyles: Record<OrganizationStatus, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-primary-soft text-primary",
  rejected: "bg-danger-soft text-danger",
  inactive: "bg-canvas text-ink-muted",
};

const AdminOrganizationsTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [organizations, setOrganizations] = useState<AdminOrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | "">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminOrganizationsListResponse>(`${baseUrl}/organizations/admin`, {
        params: {
          page: currentPage,
          limit: PAGE_LIMIT,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
        },
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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleApprove = async (organizationId: string) => {
    setActingId(organizationId);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/admin/${organizationId}/approve`, {});
      triggerToast({
        title: "Organization approved",
        description: "The organization can now be used as a workspace.",
        type: "success",
      });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (organizationId: string) => {
    setActingId(organizationId);
    try {
      await axiosReq.patch(`${baseUrl}/organizations/admin/${organizationId}/reject`, {
        rejected_reason: rejectReason.trim() || undefined,
      });
      triggerToast({
        title: "Organization rejected",
        description: "The organization request was rejected.",
        type: "success",
      });
      setRejectingId(null);
      setRejectReason("");
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="rounded-input bg-surface p-4">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-title font-medium text-ink">
            Organization <span className="font-normal italic text-primary">Requests</span>
          </p>
          <p className="mt-2 text-body-sm text-ink-muted">
            Review and approve or reject organization registrations.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
          <select
            value={statusFilter}
            onChange={(event) => {
              setCurrentPage(1);
              setStatusFilter(event.target.value as OrganizationStatus | "");
            }}
            className="h-10 rounded-input border border-border px-3 text-body-sm text-ink"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All statuses</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="flex w-full gap-2">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search organization name"
              className="h-10 w-full rounded-input border border-border px-3 text-body-sm text-ink"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-input bg-primary px-4 text-body-sm font-medium text-ink-inverse"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-border text-ink-muted">
              <th className="px-3 py-3 font-medium">Organization</th>
              <th className="px-3 py-3 font-medium">Number</th>
              <th className="px-3 py-3 font-medium">Owner</th>
              <th className="px-3 py-3 font-medium">Request Date</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">
                  Loading organizations...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="px-3 py-3 text-ink">{item.name || "—"}</td>
                  <td className="px-3 py-3 text-ink">
                    <div>{item.public_id || "—"}</div>
                    <div className="text-caption text-ink-muted">
                      {item.organization_number ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink">
                    <div>{item.owner?.full_name || "—"}</div>
                    <div className="text-caption text-ink-muted">
                      {item.owner?.email || item.owner?.phone || ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-caption font-medium capitalize ${statusStyles[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {item.status === "pending" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => void handleApprove(item.id)}
                            className="h-8 rounded-input bg-primary px-3 text-body-sm font-medium text-ink-inverse disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => {
                              setRejectingId(item.id);
                              setRejectReason("");
                            }}
                            className="h-8 rounded-input border border-danger px-3 text-body-sm font-medium text-danger disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                        {rejectingId === item.id && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={rejectReason}
                              onChange={(event) => setRejectReason(event.target.value)}
                              placeholder="Rejection reason (optional)"
                              className="h-8 w-full rounded-input border border-border px-3 text-body-sm"
                            />
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={() => void handleReject(item.id)}
                              className="h-8 shrink-0 rounded-input bg-danger px-3 text-body-sm font-medium text-ink-inverse disabled:opacity-60"
                            >
                              Confirm reject
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-ink-muted">
                        {item.rejected_reason ? item.rejected_reason : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-input border border-border disabled:opacity-40"
          aria-label="Previous page"
        >
          <PaginationChevronLeftIconSVG />
        </button>
        <span className="text-body-sm text-ink-muted">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-input border border-border disabled:opacity-40"
          aria-label="Next page"
        >
          <PaginationChevronRightIconSVG />
        </button>
      </div>
    </div>
  );
};

export default AdminOrganizationsTable;
