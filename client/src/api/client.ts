import axios from "axios";

export const TOKEN_KEY = "fincheck_token";

export const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // Let the AuthContext notice the missing token on next render.
      window.dispatchEvent(new Event("fincheck:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/** Extract a human-friendly message from an axios error. */
export function errMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.message ?? fallback;
  }
  return fallback;
}
