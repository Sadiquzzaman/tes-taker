import axios from "axios";
import { clearStoredWorkspace } from "./workspace";

const SESSION_SET_TOKEN_PATH = "/session/set-token";
const SESSION_LOGOUT_PATH = "/session/logout";

const clearAuthSession = async () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("user");
  clearStoredWorkspace();

  try {
    await axios.post(SESSION_LOGOUT_PATH);
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
  const setTokenResponse = await axios.post(SESSION_SET_TOKEN_PATH, {
    token: payload.access_token,
    refreshToken: payload.refresh_token,
    role: payload.role,
    sessionMode: payload.session_mode === "organization" ? "organization" : "individual",
    memberRole: payload.organization?.role ?? "",
    organizationId: payload.organization?.id ?? "",
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
        {
          refreshToken,
          organization_id:
            storedUser?.session_mode === "organization"
              ? storedUser.organization?.id
              : undefined,
        },
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
