"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const canManageClasses = (role?: OrganizationMemberRole) =>
  role === "OWNER" || role === "ADMIN" || role === "ASSISTANT";

const subjectLabel = (item: Class) =>
  (item.classSubjects ?? [])
    .map((row) => {
      const name = row.subject?.name;
      if (!name) return "";
      return row.subject?.code ? `${name} (${row.subject.code})` : name;
    })
    .filter(Boolean)
    .join(", ") || "—";

const OrganizationClassesContent = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<Class[]>>(`${baseUrl}/classes`);
      setClasses(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showCreate = canManageClasses(activeOrganization?.role);

  return (
    <div>
      <div className="mb-4 flex justify-between items-center w-full min-h-[40px] gap-3 flex-wrap">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Classes</p>
          <p
            className="font-[400] text-[#49734F] italic ml-2"
            style={{ fontFamily: "DM Serif Display" }}
          >
            {activeOrganization?.name || ""}
          </p>
        </div>
        {showCreate && (
          <Link
            href="/classes/create"
            className="bg-[#49734F] text-white rounded-[8px] px-4 py-2 text-sm font-medium"
          >
            + Create Class
          </Link>
        )}
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)]">
        <div className="bg-white rounded-[12px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EFF0F3] text-left text-[#232A25]">
              <tr>
                <th className="p-3">Class</th>
                <th className="p-3">Subjects</th>
                <th className="p-3">Students</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    Loading classes...
                  </td>
                </tr>
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[#747775]">
                    No classes found for this organization.
                  </td>
                </tr>
              ) : (
                classes.map((item) => (
                  <tr key={item.id} className="border-t border-[#F0F0F0]">
                    <td className="p-3 text-[#232A25]">{item.class_name || "—"}</td>
                    <td className="p-3 text-[#232A25]">{subjectLabel(item)}</td>
                    <td className="p-3 text-[#232A25]">{item.classStudents?.length ?? 0}</td>
                    <td className="p-3">
                      <Link href={`/classes/details/${item.id}`} className="text-[#49734F] font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OrganizationClasses = () => (
  <OrganizationWorkspaceGate title="Organization Classes">
    <OrganizationClassesContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationClasses;
