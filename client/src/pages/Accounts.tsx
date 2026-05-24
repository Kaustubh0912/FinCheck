import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts } from "../api/hooks";
import { AccountSheet } from "../components/AccountSheet";
import { formatMoney } from "../lib/format";
import { Icon } from "../lib/icons";
import type { Account } from "../lib/types";

export function Accounts() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { data: accounts = [] } = useAccounts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();

  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const total = live.reduce((sum, a) => sum + a.balance, 0);

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

      <div className="account-list">{live.map(card)}</div>

      {live.length === 0 && <p className="muted center pad">No accounts yet. Add a bank, cash or card to get started.</p>}

      {archived.length > 0 && (
        <>
          <div className="section-label">
            <Icon name="archive" /> Archived
          </div>
          <div className="account-list dim">{archived.map(card)}</div>
        </>
      )}

      <AccountSheet open={sheetOpen} editing={editing} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
