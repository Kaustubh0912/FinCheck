import { useMemo, useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts, useTransactions, type TxnFilters } from "../api/hooks";
import { TransactionItem } from "../components/TransactionItem";
import { AddTransactionSheet } from "../components/AddTransactionSheet";
import { ListsSheet } from "../components/ListsSheet";
import { Dropdown } from "../components/Dropdown";
import { Icon } from "../lib/icons";
import { dayKey, formatDayHeading, formatMoney } from "../lib/format";
import type { Transaction, TxnType } from "../lib/types";

const TYPE_FILTERS: { key: TxnType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expense", label: "Expense" },
  { key: "income", label: "Income" },
  { key: "transfer", label: "Transfer" },
];

export function Transactions() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const { data: accounts = [] } = useAccounts();

  const [type, setType] = useState<TxnType | "all">("all");
  const [accountId, setAccountId] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [listsOpen, setListsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSearch = () => setListsOpen(true);
    window.addEventListener("fincheck:open-search", handleOpenSearch);
    return () => window.removeEventListener("fincheck:open-search", handleOpenSearch);
  }, []);

  const filters: TxnFilters = {
    type: type === "all" ? undefined : type,
    accountId: accountId || undefined,
    limit: 300,
  };
  const { data: txns = [], isLoading } = useTransactions(filters);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of txns) {
      const key = dayKey(t.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [txns]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Activity</h1>
        <button className="icon-btn" onClick={() => setListsOpen(true)} aria-label="Search and filter">
          <Icon name="search" />
        </button>
      </header>

      <div className="type-toggle small">
        {TYPE_FILTERS.map((t) => (
          <button key={t.key} className={type === t.key ? "active" : ""} onClick={() => setType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <Dropdown
        ariaLabel="Filter by account"
        value={accountId}
        onChange={setAccountId}
        options={[
          { value: "", label: "All accounts" },
          ...accounts.map((a) => ({ value: a.id, label: a.name, icon: a.icon })),
        ]}
      />

      {isLoading ? (
        <div className="loading-dots-container">
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      ) : groups.length === 0 ? (
        <p className="muted center pad">No transactions match this filter.</p>
      ) : (
        <div className="fade-in">
          {groups.map(([day, items]) => {
            const dayTotal = items.reduce(
              (sum, t) => sum + (t.type === "income" || t.type === "reimbursement" ? t.amount : (t.type === "expense" || t.type === "saving" ? -t.amount : 0)),
              0
            );
            return (
              <section key={day} className="day-group">
                <div className="day-head">
                  <span>{formatDayHeading(day)}</span>
                  {dayTotal !== 0 && (
                    <span className={dayTotal > 0 ? "amt-income" : "amt-expense"}>
                      {dayTotal > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(dayTotal), currency)}
                    </span>
                  )}
                </div>
                <div className="txn-list">
                  {items.map((t) => (
                    <TransactionItem key={t.id} txn={t} currency={currency} onClick={() => setEditing(t)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AddTransactionSheet open={!!editing} editing={editing ?? undefined} onClose={() => setEditing(null)} />
      <ListsSheet open={listsOpen} onClose={() => setListsOpen(false)} />
    </div>
  );
}
