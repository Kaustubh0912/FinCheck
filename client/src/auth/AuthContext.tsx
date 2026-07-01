import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, TOKEN_KEY } from "../api/client";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True only while we're silently verifying an existing token against the backend. */
  hydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, currency?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // `hydrating` is true only while we silently verify an existing token.
  // The UI can show Login immediately instead of a splash screen.
  const [hydrating, setHydrating] = useState(() => {
    if ((window as any).__BONEYARD_BUILD) return false;
    return !!localStorage.getItem(TOKEN_KEY);
  });

  useEffect(() => {
    if ((window as any).__BONEYARD_BUILD) {
      setUser({ id: "mock", email: "mock@mock.com", name: "Mock", currency: "INR" });
      setLoading(false);
      return;
    }
    
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    // Abort if the backend takes too long (e.g. cold-start on free tier)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    api
      .get<{ user: User }>("/auth/me", { signal: controller.signal })
      .then((res) => setUser(res.data.user))
      .catch((err) => {
        // Only wipe the token if the server explicitly rejected it (401).
        // Network errors, timeouts, and cold-start failures should NOT
        // delete a potentially valid token.
        if (err?.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
        setHydrating(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("fincheck:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fincheck:unauthorized", onUnauthorized);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
  }

  async function register(email: string, name: string, password: string, currency?: string) {
    const res = await api.post<{ token: string; user: User }>("/auth/register", { email, name, password, currency });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, hydrating, login, register, logout, setUser }}>
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
