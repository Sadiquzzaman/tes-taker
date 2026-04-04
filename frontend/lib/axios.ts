import axios from "axios";

let axiosReq = axios.create({
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axiosReq.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      if (user) {
        const token = JSON.parse(user)?.access_token || "";
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default axiosReq;
