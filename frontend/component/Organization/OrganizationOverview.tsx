"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";
import useWorkspace from "@/hooks/organization/useWorkspace";
import OrganizationWorkspaceGate from "./OrganizationWorkspaceGate";

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[12px] bg-white p-4">
    <p className="text-[13px] text-[#747775]">{label}</p>
    <p className="mt-2 text-[28px] font-[500] text-[#232A25]">{value}</p>
  </div>
);

const OrganizationOverviewContent = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { organizationId, activeOrganization } = useWorkspace();
  const { handleError } = useApiError();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationDetail>>(
        `${baseUrl}/organizations/${organizationId}`,
      );
      setDetail(res.data?.payload ?? null);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, handleError, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex justify-between items-center w-full min-h-[40px]">
        <div className="text-[20px] md:text-[32px] tracking-[-0.04em] flex items-center gap-0 flex-wrap mr-4">
          <p className="font-[500] text-[#232A25]">Organization</p>
          <p className="font-[400] text-[#49734F] italic ml-2" style={{ fontFamily: "DM Serif Display" }}>
            {activeOrganization?.name || "Overview"}
          </p>
        </div>
      </div>

      <div className="bg-[#EFF0F3BF] rounded-[12px] p-2 sm:p-4 min-h-[calc(100vh-162px)]">
        {loading ? (
          <p className="p-4 text-[14px] text-[#747775]">Loading organization...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Teachers" value={detail?.teachers_count ?? "—"} />
            <StatCard label="Students" value={detail?.students_count ?? "—"} />
            <StatCard label="Classes" value={detail?.classes_count ?? "—"} />
            <StatCard label="Exams" value={detail?.exams_count ?? "—"} />
          </div>
        )}

        <div className="mt-4 rounded-[12px] bg-white p-4">
          <p className="text-[16px] font-[500] text-[#232A25]">Organization number</p>
          <p className="mt-1 text-[20px] font-[500] text-[#49734F]">
            {detail?.organization_number ?? activeOrganization?.organization_number ?? "—"}
          </p>
          <p className="mt-4 text-[16px] font-[500] text-[#232A25]">Status</p>
          <p className="mt-1 text-[14px] capitalize text-[#49734F]">
            {detail?.status || activeOrganization?.status || "approved"}
          </p>
          <p className="mt-3 text-[14px] text-[#747775]">
            Your role: {activeOrganization?.role || "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

const OrganizationOverview = () => (
  <OrganizationWorkspaceGate title="Organization Overview" allowedRoles={["OWNER", "ADMIN"]}>
    <OrganizationOverviewContent />
  </OrganizationWorkspaceGate>
);

export default OrganizationOverview;
