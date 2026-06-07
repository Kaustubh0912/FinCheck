import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useSummary, useTransactions } from "../api/hooks";
import { formatMoney, monthLabel, monthRange } from "../lib/format";
import { Icon } from "../lib/icons";
import { TransactionItem } from "../components/TransactionItem";
import { AddTransactionSheet } from "../components/AddTransactionSheet";
import { Sheet } from "../components/Sheet";
import type { Transaction } from "../lib/types";

export function Dashboard() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const range = useMemo(() => monthRange(monthDate), [monthDate]);

  const { data: summary } = useSummary(range);
  const { data: recent = [] } = useTransactions({ limit: 6 });
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Fetch transactions for selected category and current month
  const { data: categoryTransactions = [], isLoading: catLoading } = useTransactions({
    categoryId: selectedCategoryId ?? undefined,
    from: range.from,
    to: range.to,
  });

  const shiftMonth = (delta: number) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const cats = (summary?.byCategory ?? []).slice(0, 6);
  const maxAmt = Math.max(1, ...cats.map((c) => c.amount));

  return (
    <div className="page dashboard">
      <header className="page-head">
        <div>
          <p className="hello">Hello, {user?.name?.split(" ")[0] ?? "there"}</p>
          <h1>Overview</h1>
        </div>
      </header>

      <section className="networth-card">
        <span className="networth-label">Total balance</span>
        <span className="networth-value">{formatMoney(summary?.netWorth ?? 0, currency)}</span>
        <div className="networth-accounts">
          {summary?.accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <span key={a.id} className="networth-chip">
                <Icon name={a.icon} /> {formatMoney(a.balance, currency)}
              </span>
            ))}
        </div>
      </section>

      <div className="dash-cols">
        <div className="dash-main">
          <div className="month-switch-wrap">
            <div className="month-switch">
              <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <Icon name="chevron-left" />
              </button>
              <span>{monthLabel(monthDate)}</span>
              <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <Icon name="chevron-right" />
              </button>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-card">
              <span className="stat-label">Income</span>
              <span className="stat-value amt-income">{formatMoney(summary?.income ?? 0, currency)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Spent</span>
              <span className="stat-value amt-expense">{formatMoney(summary?.expense ?? 0, currency)}</span>
            </div>
          </div>

          {cats.length > 0 && (
            <section className="card">
              <h2 className="card-title">Where it went</h2>
              <div className="breakdown">
                {cats.map((c) => (
                  <div
                    className={`bd-row${selectedCategoryId === c.categoryId ? " active" : ""}`}
                    key={c.categoryId ?? c.name}
                    onClick={() => setSelectedCategoryId(c.categoryId ?? null)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCategoryId(c.categoryId ?? null);
                      }
                    }}
                  >
                    <div className="bd-head">
                      <span className="bd-name">
                        <Icon name={c.icon} style={{ color: c.color }} />
                        <span>{c.name}</span>
                      </span>
                      <span className="bd-amt">{formatMoney(c.amount, currency)}</span>
                    </div>
                    <div className="bd-track">
                      <div className="bd-fill" style={{ width: `${(c.amount / maxAmt) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="dash-aside">
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Recent activity</h2>
              <Link to="/transactions" className="link">
                See all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="muted center pad">No transactions yet. Tap the + button to add your first one.</p>
            ) : (
              <div className="txn-list">
                {recent.map((t) => (
                  <TransactionItem key={t.id} txn={t} currency={currency} onClick={() => setEditing(t)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet
        open={!!selectedCategoryId}
        onClose={() => setSelectedCategoryId(null)}
        title={
          (() => {
            const cat = cats.find((c) => c.categoryId === selectedCategoryId);
            if (!cat) return "Transactions";
            return (
              <span className="row gap">
                <Icon name={cat.icon} style={{ color: cat.color }} />
                <span>{cat.name}</span>
              </span>
            );
          })()
        }
      >
        {catLoading ? (
          <p className="center pad">Loading...</p>
        ) : categoryTransactions.length === 0 ? (
          <p className="muted center pad">No transactions for this category in the selected month.</p>
        ) : (
          <div className="txn-list">
            {categoryTransactions.map((t) => (
              <TransactionItem key={t.id} txn={t} currency={currency} onClick={() => setEditing(t)} />
            ))}
          </div>
        )}
      </Sheet>

      <AddTransactionSheet open={!!editing} editing={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  );
}
