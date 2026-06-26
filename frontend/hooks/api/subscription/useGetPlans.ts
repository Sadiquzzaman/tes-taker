import { useCallback, useEffect, useState } from "react";
import axiosReq from "@/lib/axios";

const useGetPlans = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosReq.get<{ payload: SubscriptionPlan[] }>(`${baseUrl}/subscriptions/plans`);
      setPlans(response.data?.payload ?? []);
    } catch {
      setError("Failed to load plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { plans, loading, error, refetch: fetchPlans };
};

export default useGetPlans;
