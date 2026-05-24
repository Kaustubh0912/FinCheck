import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAuth } from "../auth/AuthContext";
import { useSummary, useTransactions } from "../api/hooks";
import { formatMoney, monthLabel, monthRange } from "../lib/format";
import { Icon } from "../lib/icons";
import { TransactionItem } from "../components/TransactionItem";
import { AddTransactionSheet } from "../components/AddTransactionSheet";
import type { Transaction } from "../lib/types";

export function Dashboard() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [monthDate, setMonthDate] = useState(new Date());
  const range = useMemo(() => monthRange(monthDate), [monthDate]);

  const { data: summary } = useSummary(range);
  const { data: recent = [] } = useTransactions({ limit: 6 });
  const [editing, setEditing] = useState<Transaction | null>(null);

  const shiftMonth = (delta: number) =>
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const donutData = (summary?.byCategory ?? []).slice(0, 6).map((c) => ({
    name: c.name,
    value: c.amount / 100,
    color: c.color,
  }));

  return (
    <div className="page">
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

      <div className="month-switch">
        <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <Icon name="chevron-left" />
        </button>
        <span>{monthLabel(monthDate)}</span>
        <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
          <Icon name="chevron-right" />
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-ic amt-income-bg">
            <Icon name="trend-up" />
          </span>
          <div>
            <span className="stat-label">Income</span>
            <span className="stat-value amt-income">{formatMoney(summary?.income ?? 0, currency)}</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-ic amt-expense-bg">
            <Icon name="trend-down" />
          </span>
          <div>
            <span className="stat-label">Spent</span>
            <span className="stat-value amt-expense">{formatMoney(summary?.expense ?? 0, currency)}</span>
          </div>
        </div>
      </div>

      {donutData.length > 0 && (
        <section className="card">
          <h2 className="card-title">Where it went</h2>
          <div className="donut-wrap">
            <div className="donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={3} cornerRadius={5} stroke="#0a0a0c" strokeWidth={2}>
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="muted">Spent</span>
                <strong>{formatMoney(summary?.expense ?? 0, currency)}</strong>
              </div>
            </div>
            <ul className="legend">
              {summary?.byCategory.slice(0, 6).map((c) => (
                <li key={c.categoryId ?? c.name}>
                  <span className="legend-dot" style={{ background: c.color }} />
                  <span className="legend-name">
                    <Icon name={c.icon} /> {c.name}
                  </span>
                  <span className="legend-amt">{formatMoney(c.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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

      <AddTransactionSheet open={!!editing} editing={editing ?? undefined} onClose={() => setEditing(null)} />
    </div>
  );
}
