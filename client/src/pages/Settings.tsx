import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCategories } from "../api/hooks";
import { api, errMessage } from "../api/client";
import { Icon } from "../lib/icons";
import { parseSmartRange, rangeLabel } from "../lib/date";
import { useTheme } from "../lib/theme";
import { useInstallPrompt } from "../lib/useInstall";
import { CategorySheet } from "../components/CategorySheet";
import { SmartRangeInput } from "../components/SmartRangeInput";
import { PasswordSheet } from "../components/PasswordSheet";
import type { Category, CategoryKind } from "../lib/types";

export function Settings() {
  const { user, logout, setUser } = useAuth();
  const { data: categories = [] } = useCategories();
  const [theme, setTheme] = useTheme();
  const { canInstall, install, installed, isIOS } = useInstallPrompt();

  const [name, setName] = useState(user?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [reporting, setReporting] = useState(false);
  const [rangeText, setRangeText] = useState("1..t");

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

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await api.patch<{ user: typeof user }>("/auth/me", {
        name,
      });
      if (res.data.user) setUser(res.data.user);
      setProfileMsg("Saved");
      setTimeout(() => setProfileMsg(""), 1500);
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
    const range = parseSmartRange(rangeText);
    if (!range) {
      setProfileMsg("Enter a valid period, e.g. 1.1..t");
      return;
    }
    setReporting(true);
    try {
      const params = { from: range.from.toISOString(), to: range.to.toISOString() };
      const [sum, txns] = await Promise.all([
        api.get("/summary", { params }),
        api.get("/transactions", { params: { ...params, limit: 500 } }),
      ]);
      const { generateReport } = await import("../lib/report");
      generateReport({
        user: { name: user?.name ?? "", currency: user?.currency ?? "INR" },
        summary: sum.data,
        transactions: txns.data,
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
          <label className="field-label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input className="input" value={user?.email ?? ""} disabled />
        </div>
        <button className="btn btn-primary" onClick={() => saveProfile()} disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
        {profileMsg && <span className="muted save-msg">{profileMsg}</span>}
      </section>

      <section className="card">
        <h2 className="card-title">Change Password</h2>
        <button className="btn btn-ghost" onClick={() => setPasswordSheetOpen(true)}>
          <Icon name="lock" /> Change Password
        </button>
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
          {canInstall ? (
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
        <SmartRangeInput value={rangeText} onChange={setRangeText} />
        <button className="btn btn-ghost" onClick={downloadReport} disabled={reporting}>
          <Icon name="download" /> {reporting ? "Preparing report…" : "Download PDF report"}
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
        onClose={() => setPasswordSheetOpen(false)}
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
