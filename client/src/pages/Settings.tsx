import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCategories } from "../api/hooks";
import { api, errMessage } from "../api/client";
import { Icon } from "../lib/icons";
import { parseSmartRange, rangeLabel } from "../lib/date";
import { useTheme } from "../lib/theme";
import { useInstallPrompt } from "../lib/useInstall";
import { currencySymbol } from "../lib/format";
import { CategorySheet } from "../components/CategorySheet";
import { SmartRangeInput } from "../components/SmartRangeInput";
import { PasswordSheet } from "../components/PasswordSheet";
import { CharCount } from "../components/CharCount";
import type { Category, CategoryKind } from "../lib/types";
import { useDelayedPending } from "../lib/useDelayedPending";

export function Settings() {
  const { user, logout, setUser } = useAuth();
  const { data: categories = [] } = useCategories();
  const [theme, setTheme] = useTheme();
  const { canInstall, install, installed, isIOS, isAndroid } = useInstallPrompt();

  const [name, setName] = useState(user?.name ?? "");
  const [budgetInput, setBudgetInput] = useState(user?.monthlyBudget ? (user.monthlyBudget / 100).toString() : "");
  const [savingProfile, setSavingProfile] = useState(false);
  const delayedSavingProfile = useDelayedPending(savingProfile);
  const [profileMsg, setProfileMsg] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportProgressStep, setReportProgressStep] = useState(0);
  const [reportRangeText, setReportRangeText] = useState("1..t");

  useEffect(() => {
    if (!reporting) {
      setReportProgressStep(0);
      return;
    }
    const t1 = setTimeout(() => setReportProgressStep(1), 2000);
    const t2 = setTimeout(() => setReportProgressStep(2), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reporting]);

  const [catSheet, setCatSheet] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | undefined>();
  const [newKind, setNewKind] = useState<CategoryKind>("expense");

  // Password change state
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");

  const timer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBudgetInput(user.monthlyBudget ? (user.monthlyBudget / 100).toString() : "");
    }
  }, [user]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      if (!name.trim()) {
        throw new Error("Name cannot be empty");
      }
      const budgetNum = parseFloat(budgetInput);
      if (budgetInput.trim() !== "" && (isNaN(budgetNum) || budgetNum <= 0)) {
        throw new Error("Budget must be greater than 0");
      }
      const monthlyBudget = budgetInput.trim() !== "" && !isNaN(budgetNum) ? budgetNum : null;
      const res = await api.patch<{ user: typeof user }>("/auth/me", {
        name,
        monthlyBudget,
      });
      if (res.data.user) setUser(res.data.user);
      setProfileMsg("Saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setProfileMsg(""), 2000);
    } catch (e) {
      setProfileMsg(errMessage(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    setChangingPassword(true);
    setPasswordMsg("");
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords do not match");
      setChangingPassword(false);
      return;
    }
    try {
      await api.patch("/auth/me/password", {
        currentPassword,
        newPassword,
      });
      setPasswordMsg("Password changed successfully");
      // Clear the password fields and close sheet
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSheetOpen(false);
    } catch (e) {
      setPasswordMsg(errMessage(e));
    } finally {
      setChangingPassword(false);
    }
  }

  async function downloadReport() {
    const range = parseSmartRange(reportRangeText);
    if (!range) {
      setProfileMsg("Enter a valid period, e.g. 1.1..t");
      return;
    }
    setReporting(true);
    try {
      const params = { from: range.from.toISOString(), to: range.to.toISOString() };
      const [sum, txns, splitsRes] = await Promise.all([
        api.get("/summary", { params }),
        api.get("/transactions", { params: { ...params, limit: 500 } }),
        api.get("/splits", { params }),
      ]);
      const { generateReport } = await import("../lib/report");
      generateReport({
        user: { name: user?.name ?? "", currency: user?.currency ?? "INR", monthlyBudget: user?.monthlyBudget },
        summary: sum.data,
        transactions: txns.data,
        splits: splitsRes.data,
        periodLabel: rangeLabel(range.from, range.to),
      });
    } catch (e) {
      setProfileMsg(errMessage(e));
    } finally {
      setReporting(false);
    }
  }

  const income = categories.filter((c) => c.kind === "income");
  const expense = categories.filter((c) => c.kind === "expense");

  const openNewCat = (kind: CategoryKind) => {
    setNewKind(kind);
    setEditingCat(undefined);
    setCatSheet(true);
  };

  const catChip = (c: Category) => (
    <button key={c.id} className="chip" onClick={() => { setEditingCat(c); setCatSheet(true); }}>
      <Icon name={c.icon} /> {c.name}
      <Icon name="edit" className="chip-edit" />
    </button>
  );

  return (
    <div className="page settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <div className="settings-cards">
      <section className="card">
        <h2 className="card-title">Profile</h2>
        <div className="field">
          <div className="field-header">
            <label className="field-label">Name</label>
            <CharCount current={name.length} max={80} />
          </div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input className="input" value={user?.email ?? ""} disabled />
        </div>
        <div className="field">
          <label className="field-label">Monthly budget</label>
          <div className="amount-field small">
            <span className="amount-symbol">{currencySymbol(user?.currency)}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              style={{ fontSize: "1.25rem" }}
            />
          </div>
          <p className="date-hint">Your total spending limit for the month.</p>
        </div>
        <button className="btn btn-primary" onClick={() => saveProfile()} disabled={savingProfile || !name.trim()}>
          {delayedSavingProfile ? "Saving…" : "Save profile"}
        </button>
        {profileMsg && (
          <p className={profileMsg === "Saved" ? "form-success" : "form-error"}>
            {profileMsg}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Security</h2>
        <div className="field">
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Keep your account secure by maintaining a strong password.
          </p>
          <div>
            <button className="btn btn-ghost" onClick={() => setPasswordSheetOpen(true)}>
              <Icon name="lock" /> Change password
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Appearance</h2>
        <div className="theme-toggle">
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
            <Icon name="sun" /> Light
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
            <Icon name="moon" /> Dark
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Expense categories</h2>
          <button className="btn btn-pill sm" onClick={() => openNewCat("expense")}>
            <Icon name="plus" /> New
          </button>
        </div>
        <div className="chip-grid">{expense.map(catChip)}</div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Income categories</h2>
          <button className="btn btn-pill sm" onClick={() => openNewCat("income")}>
            <Icon name="plus" /> New
          </button>
        </div>
        <div className="chip-grid">{income.map(catChip)}</div>
      </section>

      {!installed && (
        <section className="card">
          <h2 className="card-title">Install app</h2>
          {isAndroid ? (
            <button className="btn btn-primary" onClick={install}>
              <Icon name="download" /> Download Android App
            </button>
          ) : canInstall ? (
            <button className="btn btn-primary" onClick={install}>
              <Icon name="download" /> Install FinCheck
            </button>
          ) : isIOS ? (
            <p className="muted">
              In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> to install FinCheck.
            </p>
          ) : (
            <p className="muted">
              Open your browser menu and choose <strong>Install app</strong> / <strong>Add to Home Screen</strong>.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Report</h2>
        <SmartRangeInput value={reportRangeText} onChange={setReportRangeText} />
        <button className="btn btn-ghost" onClick={downloadReport} disabled={reporting}>
          <Icon name="download" /> {
            reporting
              ? (reportProgressStep === 0 ? "Fetching data…" : reportProgressStep === 1 ? "Generating report…" : "Almost there…")
              : "Download PDF report"
          }
        </button>
      </section>
      </div>

      <button className="btn btn-ghost-danger full" onClick={logout}>
        <Icon name="logout" /> Log out
      </button>

      <p className="muted center version">FinCheck · v0.1</p>

      <CategorySheet open={catSheet} editing={editingCat} defaultKind={newKind} onClose={() => setCatSheet(false)} />
      <PasswordSheet
        open={passwordSheetOpen}
        onClose={() => {
          setPasswordSheetOpen(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setPasswordMsg("");
        }}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        changingPassword={changingPassword}
        passwordMsg={passwordMsg}
        changePassword={changePassword}
      />
    </div>
  );
}
