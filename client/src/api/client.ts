import axios from "axios";

export const TOKEN_KEY = "fincheck_token";

// In dev (and single-service prod) the client and API share an origin, so "/api"
// works. When the frontend is deployed separately (e.g. Vercel) point it at the
// backend by setting VITE_API_URL, e.g. https://fincheck.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL?.trim() || "/api";

export const api = axios.create({ baseURL });

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

/** Extract a human-friendly message from an axios error. Always returns a string. */
export function errMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown; message?: unknown } | undefined;
    const candidate = data?.error ?? data?.message;
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object" && typeof (candidate as { message?: unknown }).message === "string") {
      return (candidate as { message: string }).message;
    }
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
