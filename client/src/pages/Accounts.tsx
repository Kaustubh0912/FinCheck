import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts } from "../api/hooks";
import { AccountSheet } from "../components/AccountSheet";
import { GoalActionSheet } from "../components/GoalActionSheet";
import { formatMoney } from "../lib/format";
import { Icon } from "../lib/icons";
import type { Account } from "../lib/types";

export function Accounts() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { data: accounts = [] } = useAccounts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [view, setView] = useState<"balances" | "goals">("balances");
  const [goalAction, setGoalAction] = useState<{ goal: Account; mode: "add" | "withdraw" } | null>(null);

  const live = accounts.filter((a) => !a.archived && a.type !== "savings");
  const savings = accounts.filter((a) => !a.archived && a.type === "savings");
  const archived = accounts.filter((a) => a.archived);
  const total = accounts.filter(a => !a.archived).reduce((sum, a) => sum + a.balance, 0);

  const goals = savings.filter((a) => (a.goalTarget ?? 0) > 0);

  const openNew = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setSheetOpen(true);
  };

  const card = (a: Account) => (
    <button key={a.id} className="account-card" onClick={() => openEdit(a)}>
      <span className="account-icon" style={{ background: a.color + "22", color: a.color }}>
        <Icon name={a.icon} />
      </span>
      <span className="account-info">
        <span className="account-name">{a.name}</span>
        <span className="account-type">{a.type}</span>
      </span>
      <span className={`account-balance ${a.balance < 0 ? "amt-expense" : ""}`}>
        {formatMoney(a.balance, currency)}
      </span>
    </button>
  );

  const goalCard = (a: Account) => {
    const target = a.goalTarget || 1;
    const progress = Math.min(100, Math.max(0, (a.balance / target) * 100));
    return (
      <div key={a.id} className="goal-card">
        <button className="goal-info" onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div className="goal-name-wrap">
            <span className="account-icon" style={{ background: a.color + "22", color: a.color, width: 32, height: 32, borderRadius: 8 }}>
              <Icon name={a.icon} />
            </span>
            <span className="goal-name">{a.name}</span>
          </div>
          <span className="goal-pct">{Math.round(progress)}%</span>
        </button>
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${progress}%`, background: a.color }} />
        </div>
        <div className="goal-meta">
          <span>{formatMoney(a.balance, currency)} saved</span>
          <span className="goal-amt">Target: {formatMoney(target, currency)}</span>
        </div>
        <div className="row gap" style={{ marginTop: 4 }}>
          <button className="btn btn-pill sm grow" onClick={() => setGoalAction({ goal: a, mode: "add" })}>
            <Icon name="plus" /> Contribute
          </button>
          <button className="btn btn-pill sm" onClick={() => setGoalAction({ goal: a, mode: "withdraw" })}>
            Withdraw
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Accounts</h1>
        <button className="btn btn-pill" onClick={openNew}>
          <Icon name="plus" /> Add
        </button>
      </header>

      <section className="networth-card subtle">
        <span className="networth-label">Net across accounts</span>
        <span className="networth-value">{formatMoney(total, currency)}</span>
      </section>

      <div className="type-toggle" style={{ marginTop: 8 }}>
        <button className={view === "balances" ? "active" : ""} onClick={() => setView("balances")}>
          Balances
        </button>
        <button className={view === "goals" ? "active" : ""} onClick={() => setView("goals")}>
          Savings Goals
        </button>
      </div>

      {view === "balances" ? (
        <>
          <div className="account-list">{live.map(card)}</div>
          {live.length === 0 && <p className="muted center pad">No accounts yet. Add a bank, cash or card to get started.</p>}
        </>
      ) : (
        <>
          <div className="account-list">{goals.map(goalCard)}</div>
          {goals.length === 0 && (
            <div className="center pad">
              <p className="muted">No goals set yet.</p>
              <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
                Edit an account to set a target balance and track your progress here.
              </p>
            </div>
          )}
        </>
      )}

      {archived.length > 0 && view === "balances" && (
        <>
          <div className="section-label">
            <Icon name="archive" /> Archived
          </div>
          <div className="account-list dim">{archived.map(card)}</div>
        </>
      )}

      <AccountSheet open={sheetOpen} editing={editing} onClose={() => setSheetOpen(false)} />

      {goalAction && (
        <GoalActionSheet
          open={!!goalAction}
          goal={goalAction.goal}
          mode={goalAction.mode}
          onClose={() => setGoalAction(null)}
        />
      )}
    </div>
  );
}
