import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { clearAuthSession, getStoredUser, refreshAuthSession } from "./authSession";

let axiosReq = axios.create({
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axiosReq.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const user = getStoredUser();
      const token = user?.access_token ?? "";
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosReq.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes("/auth/refresh")) {
      await clearAuthSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const refreshedUser = await refreshAuthSession();
    if (!refreshedUser?.access_token) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${refreshedUser.access_token}`;
    return axiosReq(originalRequest);
  },
);

export default axiosReq;
