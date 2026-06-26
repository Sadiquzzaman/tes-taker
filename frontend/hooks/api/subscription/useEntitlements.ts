import { useCallback, useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";

const useEntitlements = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [entitlements, setEntitlements] = useState<EntitlementsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosReq.get<{ payload: EntitlementsPayload }>(
        `${baseUrl}/subscriptions/my-entitlements`,
      );
      setEntitlements(response.data?.payload ?? null);
    } catch {
      setError("Failed to load entitlements");
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  const hasFeature = useCallback(
    (key: string) => Boolean(entitlements?.features?.[key as keyof typeof entitlements.features]),
    [entitlements],
  );

  const isExamLimitReached = useMemo(() => {
    if (!entitlements?.usage || !entitlements?.limits) return false;

    const monthlyLimit = entitlements.limits.max_exams_per_month ?? 0;
    if (monthlyLimit > 0 && entitlements.usage.exams_used_this_month >= monthlyLimit) {
      return true;
    }

    const totalLimit = entitlements.limits.max_total_exams ?? 0;
    if (totalLimit > 0 && entitlements.usage.total_exams_used >= totalLimit) {
      return true;
    }

    return false;
  }, [entitlements]);

  return { entitlements, loading, error, hasFeature, isExamLimitReached, refetch: fetchEntitlements };
};

export default useEntitlements;
