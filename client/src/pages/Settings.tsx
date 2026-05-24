import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCategories } from "../api/hooks";
import { api, errMessage } from "../api/client";
import { Icon } from "../lib/icons";
import { monthLabel, monthRange } from "../lib/format";
import { useTheme } from "../lib/theme";
import { useInstallPrompt } from "../lib/useInstall";
import { CategorySheet } from "../components/CategorySheet";
import type { Category, CategoryKind } from "../lib/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

export function Settings() {
  const { user, logout, setUser } = useAuth();
  const { data: categories = [] } = useCategories();
  const [theme, setTheme] = useTheme();
  const { canInstall, install, installed, isIOS } = useInstallPrompt();

  const [name, setName] = useState(user?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [reporting, setReporting] = useState(false);

  const [catSheet, setCatSheet] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | undefined>();
  const [newKind, setNewKind] = useState<CategoryKind>("expense");

  async function saveProfile(currency?: string) {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await api.patch<{ user: typeof user }>("/auth/me", {
        name,
        ...(currency ? { currency } : {}),
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

  async function downloadReport() {
    setReporting(true);
    try {
      const range = monthRange(new Date());
      const [sum, txns] = await Promise.all([
        api.get("/summary", { params: range }),
        api.get("/transactions", { params: { ...range, limit: 500 } }),
      ]);
      const { generateReport } = await import("../lib/report");
      generateReport({
        user: { name: user?.name ?? "", currency: user?.currency ?? "INR" },
        summary: sum.data,
        transactions: txns.data,
        periodLabel: monthLabel(),
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
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

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
        <h2 className="card-title">Currency</h2>
        <div className="chip-row">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              className={`chip ${user?.currency === c ? "chip-active" : ""}`}
              onClick={() => saveProfile(c)}
            >
              {c}
            </button>
          ))}
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
        <h2 className="card-title">Data</h2>
        <button className="btn btn-ghost" onClick={downloadReport} disabled={reporting}>
          <Icon name="download" /> {reporting ? "Preparing report…" : "Download PDF report"}
        </button>
      </section>

      <button className="btn btn-ghost-danger full" onClick={logout}>
        <Icon name="logout" /> Log out
      </button>

      <p className="muted center version">FinCheck · v0.1</p>

      <CategorySheet open={catSheet} editing={editingCat} defaultKind={newKind} onClose={() => setCatSheet(false)} />
    </div>
  );
}
