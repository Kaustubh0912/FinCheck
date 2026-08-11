import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { api, TOKEN_KEY } from "../api/client";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True while an existing token is being verified against the backend. */
  hydrating: boolean;
  hydrationError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, currency?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  retryHydration: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [hydrating, setHydrating] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const retryHydration = useCallback(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    setHydrationError(null);
    setLoading(true);
    setHydrating(true);
    setHydrationAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      setHydrating(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function hydrate() {
      // Render Free can take close to a minute to wake. Axios therefore waits
      // up to 75 seconds, then this recovery flow makes a couple of retries.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await api.get<{ user: User }>("/auth/me", { signal: controller.signal });
          if (active) setUser(res.data.user);
          return;
        } catch (err) {
          if (controller.signal.aborted || !active) return;
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            return;
          }
          if (attempt < 2) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, (attempt + 1) * 1500));
            if (controller.signal.aborted || !active) return;
            continue;
          }
          if (active) {
            setHydrationError("We couldn't reconnect to FinCheck. Your session is safe; try again once the service is awake.");
          }
        }
      }
    }

    hydrate().finally(() => {
      // Cleanup aborts only an unmounted effect. A mounted app must always
      // settle its loading state, even after a timeout or network error.
      if (!active) return;
      setLoading(false);
      setHydrating(false);
    });

    return () => { active = false; controller.abort(); };
  }, [hydrationAttempt]);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("fincheck:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fincheck:unauthorized", onUnauthorized);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setHydrationError(null);
    setUser(res.data.user);
  }

  async function register(email: string, name: string, password: string, currency?: string) {
    const res = await api.post<{ token: string; user: User }>("/auth/register", { email, name, password, currency });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setHydrationError(null);
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setHydrationError(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, hydrating, hydrationError, login, register, logout, setUser, retryHydration }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
