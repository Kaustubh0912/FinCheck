import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../lib/icons";
import { errMessage } from "../api/client";
import { useDelayedPending } from "../lib/useDelayedPending";
import { PasswordChecklist } from "../components/PasswordChecklist";

function detectDefaultCurrency(): string {
  if (typeof navigator === "undefined") return "INR";
  const lang = navigator.language || "";
  if (lang.startsWith("en-US")) return "USD";
  if (lang.startsWith("en-GB")) return "GBP";
  if (lang.includes("EUR") || lang.startsWith("de") || lang.startsWith("fr") || lang.startsWith("es") || lang.startsWith("it")) return "EUR";
  return "INR";
}

export function Login({ hydrating, sessionError, onRetrySession }: {
  hydrating?: boolean;
  sessionError?: string | null;
  onRetrySession?: () => void;
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState(detectDefaultCurrency);
  const [error, setError] = useState("");
  const [emailBlurError, setEmailBlurError] = useState("");
  const [busy, setBusy] = useState(false);
  const delayedBusy = useDelayedPending(busy);

  // Email format check
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isValidPassword = mode === "register" ? password.length >= 8 && /[0-9]/.test(password) : password.length > 0;
  const isValidName = mode === "login" || name.trim().length > 0;

  const canSubmit = isValidEmail && isValidPassword && isValidName;

  function validateEmailInline() {
    if (email.trim() && !isValidEmail) {
      setEmailBlurError("Please enter a valid email address");
    } else {
      setEmailBlurError("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setEmailBlurError("");
    setBusy(true);
    try {
      const cleanEmail = email.trim();
      const cleanName = name.trim();
      if (mode === "login") await login(cleanEmail, password);
      else await register(cleanEmail, cleanName, password, currency);
    } catch (err) {
      setError(errMessage(err, "Could not sign in"));
    } finally {
      setBusy(false);
    }
  }

  function getMissingHint() {
    if (!email.trim()) return "Enter your email address";
    if (!isValidEmail) return "Enter a valid email address";
    if (mode === "register" && !name.trim()) return "Enter your name";
    if (!password) return "Enter your password";
    if (mode === "register" && !isValidPassword) return "Meet all password requirements";
    return "";
  }

  return (
    <div className="auth-page">
      {hydrating && <div className="auth-hydrating-bar" />}
      <div className="auth-card">
        <div className="auth-brand">
          <div className="splash-logo"><Icon name="rupee" /></div>
          <h1>FinCheck</h1>
          <p className="muted">Track every rupee across your accounts.</p>
        </div>

        {sessionError && (
          <div className="auth-session-banner" role="alert">
            <div className="auth-session-banner-header">
              <div className="auth-session-banner-icon">
                <Icon name="rotate" />
              </div>
              <div className="auth-session-banner-body">
                <div className="auth-session-banner-title">Saved session found</div>
                <div className="auth-session-banner-desc">{sessionError}</div>
              </div>
            </div>
            {onRetrySession && (
              <button
                type="button"
                className="btn-session-retry"
                onClick={onRetrySession}
              >
                <Icon name="rotate" />
                <span>Retry session</span>
              </button>
            )}
          </div>
        )}

        <div className="type-toggle">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); setEmailBlurError(""); }}>
            Log in
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); setEmailBlurError(""); }}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <>
              <div className="field">
                <label className="field-label">Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Primary currency</label>
                <select className="input select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="INR">₹ Indian Rupee (INR)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                  <option value="GBP">£ British Pound (GBP)</option>
                </select>
              </div>
            </>
          )}
          <div className="field">
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailBlurError) setEmailBlurError(""); }}
              onBlur={validateEmailInline}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {emailBlurError && <p className="inline-error">{emailBlurError}</p>}
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              maxLength={200}
              required
            />
            {mode === "register" && (
              <PasswordChecklist password={password} />
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary grow" disabled={busy || !canSubmit}>
            {delayedBusy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          {!canSubmit && !busy && (
            <p className="field-hint">{getMissingHint()}</p>
          )}
        </form>
      </div>
    </div>
  );
}
