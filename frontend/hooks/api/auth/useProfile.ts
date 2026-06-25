import { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import axiosReq from "@/lib/axios";
import { useApiError } from "@/hooks/api/useApiError";

const useProfile = () => {
  const { handleError } = useApiError();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const response = await axiosReq.get<ApiResponse<UserProfile>>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/auth/profile`,
      );
      setProfile(response.data.payload);
    } catch (err) {
      setError(true);
      handleError(err as AxiosError<ApiError>);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refetch: fetchProfile };
};

export default useProfile;
