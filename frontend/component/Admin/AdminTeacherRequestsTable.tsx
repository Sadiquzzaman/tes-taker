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

const statusStyles: Record<TeacherRequestStatus, string> = {
  pending: "bg-[#FFF4E5] text-[#B54708]",
  approved: "bg-[#EAF2EB] text-[#49734F]",
  rejected: "bg-[#FEECEC] text-[#D24B44]",
};

const AdminTeacherRequestsTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [requests, setRequests] = useState<AdminTeacherRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherRequestStatus | "">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminTeacherRequestsListResponse>(
        `${baseUrl}/teacher-requests/admin`,
        {
          params: {
            page: currentPage,
            limit: PAGE_LIMIT,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
          },
        },
      );
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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleReview = async (requestId: string, action: "approve" | "reject") => {
    setActingId(requestId);
    try {
      await axiosReq.patch(`${baseUrl}/teacher-requests/admin/${requestId}/${action}`, {});
      triggerToast({
        title: action === "approve" ? "Request approved" : "Request rejected",
        description:
          action === "approve"
            ? "The user is now a teacher."
            : "The user remains a student.",
        type: "success",
      });
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
            Teacher <span className="font-[400] italic text-[#49734F]">Requests</span>
          </p>
          <p className="mt-2 text-[14px] text-[#747775]">
            Review student requests to become teachers.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
          <select
            value={statusFilter}
            onChange={(event) => {
              setCurrentPage(1);
              setStatusFilter(event.target.value as TeacherRequestStatus | "");
            }}
            className="h-10 rounded-[8px] border border-[#E5E5E5] px-3 text-[14px] text-[#232A25]"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="flex w-full gap-2">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name or email"
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
              <th className="px-3 py-3 font-[500]">Name</th>
              <th className="px-3 py-3 font-[500]">Email</th>
              <th className="px-3 py-3 font-[500]">Request Date</th>
              <th className="px-3 py-3 font-[500]">Status</th>
              <th className="px-3 py-3 font-[500]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#747775]">
                  Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#747775]">
                  No teacher requests found.
                </td>
              </tr>
            ) : (
              requests.map((item) => (
                <tr key={item.id} className="border-b border-[#F0F0F0]">
                  <td className="px-3 py-3 text-[#232A25]">{item.user.full_name || "—"}</td>
                  <td className="px-3 py-3 text-[#232A25]">{item.user.email || "—"}</td>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void handleReview(item.id, "approve")}
                          className="h-8 rounded-[8px] bg-[#49734F] px-3 text-[13px] font-[500] text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void handleReview(item.id, "reject")}
                          className="h-8 rounded-[8px] border border-[#D24B44] px-3 text-[13px] font-[500] text-[#D24B44] disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#747775]">—</span>
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

export default AdminTeacherRequestsTable;
