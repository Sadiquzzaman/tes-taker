"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useToast } from "@/component/Toast/ToastContext";
import { useApiError } from "@/hooks/api/useApiError";
import PaginationChevronLeftIconSVG from "../svg/PaginationChevronLeftIconSVG";
import PaginationChevronRightIconSVG from "../svg/PaginationChevronRightIconSVG";

const PAGE_LIMIT = 20;

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const AdminUsersTable = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { triggerToast } = useToast();
  const { handleError } = useApiError();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosReq.get<AdminUsersListResponse>(`${baseUrl}/user/admin/users`, {
        params: {
          page: currentPage,
          limit: PAGE_LIMIT,
          search: search.trim() || undefined,
        },
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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput);
  };

  const handleRoleChange = async (user: AdminUserListItem, nextRole: "STUDENT" | "TEACHER") => {
    if (user.role === nextRole || user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      return;
    }

    setUpdatingUserId(user.id);
    try {
      await axiosReq.patch(`${baseUrl}/user/admin/users/${user.id}/role`, { role: nextRole });
      triggerToast({
        title: "Role updated",
        description: `${user.full_name || "User"} is now a ${nextRole.toLowerCase()}.`,
        type: "success",
      });
      await loadData();
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) {
      return;
    }

    setCurrentPage(page);
  };

  return (
    <div className="rounded-[8px] bg-white p-4">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[24px] font-[500] leading-[24px] tracking-[-0.02em] text-[#232A25]">
            User <span className="font-[400] italic text-[#49734F]">Details</span>
          </p>
          <p className="mt-2 text-[14px] text-[#747775]">Search by name or phone and manage user roles.</p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or phone"
            className="h-10 flex-1 rounded-[8px] border border-[#E5E5E5] px-3 text-[14px] text-[#232A25] placeholder:text-[#747775]"
          />
          <button
            type="submit"
            className="h-10 rounded-[8px] bg-[#49734F] px-4 text-[14px] font-[500] text-white"
          >
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full table-fixed">
          <thead>
            <tr className="h-10 border-b border-[#EFF0F3] text-left text-[14px] font-[500] text-[#232A25]">
              <th className="p-2">Name</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Email</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[14px] text-[#747775]">
                  Loading users...
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[14px] text-[#747775]">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              users.map((user) => {
                const isAdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
                const isActive = user.is_active === 1;

                return (
                  <tr key={user.id} className="border-b border-[#EFF0F3] text-[14px] text-[#747775]">
                    <td className="p-2">{user.full_name || "—"}</td>
                    <td className="p-2">{user.phone || "—"}</td>
                    <td className="p-2">{user.email || "—"}</td>
                    <td className="p-2">
                      {isAdminRole ? (
                        <span className="rounded-[27px] border border-[#E5E5E5] px-2 py-1 text-[12px] font-[500] text-[#232A25]">
                          {user.role}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          disabled={updatingUserId === user.id}
                          onChange={(event) =>
                            handleRoleChange(user, event.target.value as "STUDENT" | "TEACHER")
                          }
                          className="h-8 rounded-[8px] border border-[#E5E5E5] bg-white px-2 text-[13px] text-[#232A25] disabled:opacity-50"
                        >
                          <option value="STUDENT">Student</option>
                          <option value="TEACHER">Teacher</option>
                        </select>
                      )}
                    </td>
                    <td className="p-2">
                      <span
                        className={`rounded-[27px] px-2 py-1 text-[12px] font-[500] ${
                          isActive ? "bg-[#49734F15] text-[#49734F]" : "bg-[#EFF0F3] text-[#747775]"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-2">{formatDate(user.created_at)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E5E5E5] disabled:opacity-50"
        >
          <PaginationChevronLeftIconSVG width={16} />
        </button>
        <span className="text-[14px] text-[#747775]">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#E5E5E5] disabled:opacity-50"
        >
          <PaginationChevronRightIconSVG width={16} />
        </button>
      </div>
    </div>
  );
};

export default AdminUsersTable;
