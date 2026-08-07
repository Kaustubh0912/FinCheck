import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useSplits, useRepaySplit, useAccounts } from "../api/hooks";
import { formatMoney } from "../lib/format";
import { Icon } from "../lib/icons";
import { resolveThemeColor } from "../lib/colors";
import type { Split } from "../lib/types";
import { useDelayedPending } from "../lib/useDelayedPending";

export function Splits() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [tab, setTab] = useState<"pending" | "settled">("pending");
  const isSettled = tab === "settled";

  const { data: splits = [], isLoading } = useSplits(isSettled);
  const { data: accounts = [] } = useAccounts();
  const liveAccounts = accounts.filter(a => !a.archived && a.type !== "savings");

  return (
    <div className="page splits">
      <header className="page-head">
        <div>
          <p className="hello">Group expenses</p>
          <h1>Splits</h1>
        </div>
      </header>

      <div className="type-toggle">
        <button className={!isSettled ? "active" : ""} onClick={() => setTab("pending")}>Pending</button>
        <button className={isSettled ? "active" : ""} onClick={() => setTab("settled")}>Settled</button>
      </div>

      <div className="account-list">
        {isLoading ? (
          <div className="loading-dots-container">
            <div className="loading-dots"><span /><span /><span /></div>
          </div>
        ) : splits.length === 0 ? (
          <p className="muted center pad">No {tab} splits found.</p>
        ) : (
          <div className="fade-in">
            {splits.map((split) => (
              <SplitCard key={split.id} split={split} currency={currency} isSettled={isSettled} liveAccounts={liveAccounts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SplitCard({ split, currency, isSettled, liveAccounts }: { split: Split; currency: string; isSettled: boolean; liveAccounts: import("../lib/types").Account[] }) {
  const repaySplit = useRepaySplit();
  const delayedRepayPending = useDelayedPending(repaySplit.isPending);

  const [showRepay, setShowRepay] = useState(false);
  const [amount, setAmount] = useState("");
  const [toAccountId, setToAccountId] = useState(liveAccounts[0]?.id ?? "");

  const totalOwed = split.totalAmount - split.myShare;
  const progress = totalOwed > 0 ? Math.min(100, (split.settledAmount / totalOwed) * 100) : 100;
  const remaining = totalOwed - split.settledAmount;

  useEffect(() => {
    if (!toAccountId && liveAccounts.length > 0) {
      setToAccountId(liveAccounts[0].id);
    }
  }, [liveAccounts, toAccountId]);

  const handleRepay = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || !toAccountId) return;
    
    repaySplit.mutate(
      { id: split.id, amount: val, toAccountId },
      { onSuccess: () => { setShowRepay(false); setAmount(""); } }
    );
  };

  return (
    <div className="goal-card">
      <div className="goal-info">
        <div className="goal-name-wrap">
          <span className="goal-name">{split.splitNote || "Split Expense"}</span>
        </div>
        <span className="goal-pct">{Math.round(progress)}%</span>
      </div>

      <div className="goal-track">
        <div className="goal-fill" style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }} />
      </div>

      <div className="goal-meta">
        <span>Total bill <span className="serif">{formatMoney(split.totalAmount, currency)}</span> · Your share <span className="serif">{formatMoney(split.myShare, currency)}</span> · Owed to you <span className="serif">{formatMoney(totalOwed, currency)}</span></span>
      </div>

      {!isSettled && (
        <div style={{ marginTop: 12 }}>
          {!showRepay ? (
            <button className="btn btn-pill sm" onClick={() => setShowRepay(true)}>
              Record repayment
            </button>
          ) : (
            <div className="card" style={{ paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div className="field">
                <label className="field-label">Amount</label>
                <input 
                  type="number" 
                  className="input sm" 
                  placeholder={String(remaining / 100)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label className="field-label">Deposit to</label>
                <div className="chip-row">
                  {liveAccounts.map((a) => (
                    <button
                      key={a.id}
                      className={`chip ${toAccountId === a.id ? "chip-active" : ""}`}
                      style={toAccountId === a.id ? { borderColor: resolveThemeColor(a.color), color: resolveThemeColor(a.color) } : undefined}
                      onClick={() => setToAccountId(a.id)}
                    >
                      <Icon name={a.icon} /> {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row gap" style={{ marginTop: 12 }}>
                <button className="btn btn-ghost grow" onClick={() => setShowRepay(false)}>Cancel</button>
                <button className="btn btn-primary grow" onClick={handleRepay} disabled={repaySplit.isPending}>
                  {delayedRepayPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
