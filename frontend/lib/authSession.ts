import axios from "axios";

const clearAuthSession = async () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("user");

  try {
    await axios.post("/api/logout");
  } catch {
    // Ignore logout API failures while clearing local session.
  }

  window.location.href = "/login";
};

const getStoredUser = (): LoginResponsePayload | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LoginResponsePayload;
  } catch {
    return null;
  }
};

const persistAuthSession = async (payload: LoginResponsePayload) => {
  const setTokenResponse = await axios.post("/api/set-token", {
    token: payload.access_token,
    refreshToken: payload.refresh_token,
    role: payload.role,
  });

  if (setTokenResponse.status !== 200) {
    throw new Error("Failed to store auth session");
  }

  localStorage.setItem("user", JSON.stringify(payload));
};

let refreshPromise: Promise<LoginResponsePayload | null> | null = null;

export const refreshAuthSession = async (): Promise<LoginResponsePayload | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const storedUser = getStoredUser();
    const refreshToken = storedUser?.refresh_token;

    if (!refreshToken) {
      await clearAuthSession();
      return null;
    }

    try {
      const response = await axios.post<{ payload: LoginResponsePayload }>(
        `${process.env.NEXT_PUBLIC_BASE_URL}/auth/refresh`,
        { refreshToken },
      );

      const payload = response.data.payload;
      await persistAuthSession(payload);
      return payload;
    } catch {
      await clearAuthSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export { clearAuthSession, getStoredUser, persistAuthSession };
