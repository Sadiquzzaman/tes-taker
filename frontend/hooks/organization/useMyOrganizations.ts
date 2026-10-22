"use client";

import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";

export const useMyOrganizations = (enabled = true) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const { handleError } = useApiError();
  const [organizations, setOrganizations] = useState<OrganizationWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axiosReq.get<ApiResponse<OrganizationWorkspaceItem[]>>(
        `${baseUrl}/organizations/mine`,
      );
      setOrganizations(res.data?.payload ?? []);
    } catch (error) {
      handleError(error as AxiosError<ApiError>);
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, enabled, handleError]);

  useEffect(() => {
    void load();
  }, [load]);

  return { organizations, loading, refetch: load };
};

export default useMyOrganizations;
