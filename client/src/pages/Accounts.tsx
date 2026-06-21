import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts, useReorderAccounts } from "../api/hooks";
import { AccountSheet } from "../components/AccountSheet";
import { GoalActionSheet } from "../components/GoalActionSheet";
import { formatMoney } from "../lib/format";
import { Icon } from "../lib/icons";
import { resolveThemeColor } from "../lib/colors";
import type { Account } from "../lib/types";

export function Accounts() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { data: accounts } = useAccounts();
  const reorderAccounts = useReorderAccounts();
  const [orderedAccounts, setOrderedAccounts] = useState<Account[]>([]);
  
  useEffect(() => {
    if (accounts) {
      setOrderedAccounts(accounts);
    }
  }, [accounts]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [view, setView] = useState<"balances" | "goals">("balances");
  const [goalAction, setGoalAction] = useState<{ goal: Account; mode: "add" | "withdraw" } | null>(null);

  const live = orderedAccounts.filter((a) => !a.archived && a.type !== "savings");
  const savings = orderedAccounts.filter((a) => !a.archived && a.type === "savings");
  const archived = orderedAccounts.filter((a) => a.archived);
  const total = orderedAccounts.filter(a => !a.archived).reduce((sum, a) => sum + a.balance, 0);

  const goals = savings.filter((a) => (a.goalTarget ?? 0) > 0);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDragEnd = () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      const newAccs = [...orderedAccounts];
      const fromIdx = newAccs.findIndex(a => a.id === draggedId);
      const toIdx = newAccs.findIndex(a => a.id === dragOverId);
      
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = newAccs.splice(fromIdx, 1);
        newAccs.splice(toIdx, 0, moved);
        setOrderedAccounts(newAccs);
        
        reorderAccounts.mutate(newAccs.map((a, i) => ({ id: a.id, order: i })));
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const openNew = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setSheetOpen(true);
  };

  const card = (a: Account) => {
    const isDragged = a.id === draggedId;
    const isOver = a.id === dragOverId;
    const fromIdx = orderedAccounts.findIndex(acc => acc.id === draggedId);
    const toIdx = orderedAccounts.findIndex(acc => acc.id === a.id);
    
    return (
      <div 
        key={a.id} 
        draggable
        onDragStart={(e) => handleDragStart(e, a.id)}
        onDragOver={(e) => handleDragOver(e, a.id)}
        onDragEnd={handleDragEnd}
        style={{
           opacity: isDragged ? 0.5 : 1,
           borderTop: isOver && toIdx < fromIdx ? "2px solid var(--accent)" : "none",
           borderBottom: isOver && toIdx > fromIdx ? "2px solid var(--accent)" : "none",
           position: "relative",
           display: "flex",
           alignItems: "center",
           cursor: "grab"
        }}
      >
        <button className="account-card" onClick={() => openEdit(a)} style={{ flex: 1, borderBottom: "none", paddingRight: 0 }}>
          <span className="account-icon" style={{ background: `color-mix(in srgb, ${resolveThemeColor(a.color)} 13%, transparent)`, color: resolveThemeColor(a.color) }}>
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
        <div style={{ padding: "16px 8px 16px 12px", color: "var(--faint)" }}>
          <Icon name="grip-vertical" />
        </div>
      </div>
    );
  };

  const goalCard = (a: Account) => {
    const target = a.goalTarget || 1;
    const progress = Math.min(100, Math.max(0, (a.balance / target) * 100));
    const isDragged = a.id === draggedId;
    const isOver = a.id === dragOverId;
    const fromIdx = orderedAccounts.findIndex(acc => acc.id === draggedId);
    const toIdx = orderedAccounts.findIndex(acc => acc.id === a.id);
    
    return (
      <div 
        key={a.id} 
        className="goal-card"
        draggable
        onDragStart={(e) => handleDragStart(e, a.id)}
        onDragOver={(e) => handleDragOver(e, a.id)}
        onDragEnd={handleDragEnd}
        style={{
           opacity: isDragged ? 0.5 : 1,
           borderTop: isOver && toIdx < fromIdx ? "2px solid var(--accent)" : "none",
           borderBottom: isOver && toIdx > fromIdx ? "2px solid var(--accent)" : "none",
           position: "relative",
           cursor: "grab"
        }}
      >
        <button className="goal-info" onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'grab', textAlign: 'left', width: '100%' }}>
          <div className="goal-name-wrap">
            <span className="account-icon" style={{ background: `color-mix(in srgb, ${resolveThemeColor(a.color)} 13%, transparent)`, color: resolveThemeColor(a.color), width: 32, height: 32, borderRadius: 8 }}>
              <Icon name={a.icon} />
            </span>
            <span className="goal-name">{a.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="goal-pct">{Math.round(progress)}%</span>
            <span style={{ color: "var(--faint)" }}><Icon name="grip-vertical" /></span>
          </div>
        </button>
        <div className="goal-track">
          <div className="goal-fill" style={{ width: `${progress}%`, background: resolveThemeColor(a.color) }} />
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
