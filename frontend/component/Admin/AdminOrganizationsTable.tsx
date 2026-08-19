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
  pending: "bg-[#FFF4E5] text-[#B54708]",
  approved: "bg-[#EAF2EB] text-[#49734F]",
  rejected: "bg-[#FEECEC] text-[#D24B44]",
  inactive: "bg-[#EFF0F3] text-[#747775]",
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
    <div className="rounded-[8px] bg-white p-4">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[24px] font-[500] leading-[24px] tracking-[-0.02em] text-[#232A25]">
            Organization <span className="font-[400] italic text-[#49734F]">Requests</span>
          </p>
          <p className="mt-2 text-[14px] text-[#747775]">
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
            className="h-10 rounded-[8px] border border-[#E5E5E5] px-3 text-[14px] text-[#232A25]"
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
              className="h-10 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-[14px] text-[#232A25]"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] text-white"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[14px]">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-[#747775]">
              <th className="px-3 py-3 font-[500]">Organization</th>
              <th className="px-3 py-3 font-[500]">Number</th>
              <th className="px-3 py-3 font-[500]">Owner</th>
              <th className="px-3 py-3 font-[500]">Request Date</th>
              <th className="px-3 py-3 font-[500]">Status</th>
              <th className="px-3 py-3 font-[500]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#747775]">
                  Loading organizations...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[#747775]">
                  No organizations found.
                </td>
              </tr>
            ) : (
              organizations.map((item) => (
                <tr key={item.id} className="border-b border-[#F0F0F0]">
                  <td className="px-3 py-3 text-[#232A25]">{item.name || "—"}</td>
                  <td className="px-3 py-3 text-[#232A25]">
                    <div>{item.public_id || "—"}</div>
                    <div className="text-[12px] text-[#747775]">
                      {item.organization_number ?? ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#232A25]">
                    <div>{item.owner?.full_name || "—"}</div>
                    <div className="text-[12px] text-[#747775]">
                      {item.owner?.email || item.owner?.phone || ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#232A25]">{formatDate(item.created_at)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[12px] font-[500] capitalize ${statusStyles[item.status]}`}
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
                            className="h-8 rounded-[8px] bg-[#49734F] px-3 text-[13px] font-[500] text-white disabled:opacity-60"
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
                            className="h-8 rounded-[8px] border border-[#D24B44] px-3 text-[13px] font-[500] text-[#D24B44] disabled:opacity-60"
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
                              className="h-8 w-full rounded-[8px] border border-[#E5E5E5] px-3 text-[13px]"
                            />
                            <button
                              type="button"
                              disabled={actingId === item.id}
                              onClick={() => void handleReject(item.id)}
                              className="h-8 shrink-0 rounded-[8px] bg-[#D24B44] px-3 text-[13px] font-[500] text-white disabled:opacity-60"
                            >
                              Confirm reject
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#747775]">
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
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E5E5] disabled:opacity-40"
          aria-label="Previous page"
        >
          <PaginationChevronLeftIconSVG />
        </button>
        <span className="text-[13px] text-[#747775]">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E5E5] disabled:opacity-40"
          aria-label="Next page"
        >
          <PaginationChevronRightIconSVG />
        </button>
      </div>
    </div>
  );
};

export default AdminOrganizationsTable;
