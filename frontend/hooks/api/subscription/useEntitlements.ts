import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axiosReq from "@/lib/axios";

export type EntitlementsState = {
  entitlements: EntitlementsPayload | null;
  loading: boolean;
  error: string | null;
  hasFeature: (key: string) => boolean;
  isExamLimitReached: boolean;
  refetch: () => Promise<void>;
};

/** Filled by EntitlementsProvider so every component on a page shares one request. */
export const EntitlementsContext = createContext<EntitlementsState | null>(null);

/**
 * Loads the current workspace's entitlements (GET /me/entitlements, design §8.3). With
 * `enabled` false nothing is fetched (signed out, students, platform admins); null means "not known
 * yet" and stays loading. `reloadKey` refetches when the workspace changes.
 */
export const useEntitlementsState = (enabled: boolean | null = true, reloadKey?: string): EntitlementsState => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [entitlements, setEntitlements] = useState<EntitlementsPayload | null>(null);
  const [loading, setLoading] = useState(enabled !== false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntitlements = useCallback(async () => {
    if (enabled === null) return;
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await axiosReq.get<{ payload: EntitlementsPayload }>(`${baseUrl}/me/entitlements`);
      setEntitlements(response.data?.payload ?? null);
    } catch {
      setError("Failed to load entitlements");
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, enabled]);

  // A new workspace (reloadKey) means new entitlements.
  useEffect(() => {
    void fetchEntitlements();
  }, [fetchEntitlements, reloadKey]);

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

/** The current workspace's plan, features, limits and usage; shared through EntitlementsProvider when present. */
const useEntitlements = (): EntitlementsState => {
  const shared = useContext(EntitlementsContext);
  const own = useEntitlementsState(!shared);
  return shared ?? own;
};

export default useEntitlements;
