import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Icon } from "../lib/icons";
import { useAccounts, useSaveTransaction } from "../api/hooks";
import { currencySymbol, formatMoney } from "../lib/format";
import { resolveThemeColor } from "../lib/colors";
import { useAuth } from "../auth/AuthContext";
import { errMessage } from "../api/client";
import type { Account } from "../lib/types";
import { useDelayedPending } from "../lib/useDelayedPending";

interface Props {
  open: boolean;
  onClose: () => void;
  goal: Account;
  mode: "add" | "withdraw";
}

export function GoalActionSheet({ open, onClose, goal, mode }: Props) {
  const { user } = useAuth();
  const symbol = currencySymbol(user?.currency);
  const { data: accounts = [] } = useAccounts();
  const saveTxn = useSaveTransaction();
  const delayedSavePending = useDelayedPending(saveTxn.isPending);

  const [amount, setAmount] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [error, setError] = useState("");

  const otherAccounts = useMemo(
    () => accounts.filter((a) => !a.archived && a.type !== "savings"),
    [accounts]
  );

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (open && !sourceAccountId && otherAccounts.length > 0) {
      setSourceAccountId(otherAccounts[0].id);
    }
  }, [open, otherAccounts, sourceAccountId]);

  const numVal = Number(amount);
  const canSubmit = !isNaN(numVal) && numVal > 0 && !!sourceAccountId;

  function getMissingHint() {
    if (!numVal || numVal <= 0) return "Enter an amount greater than zero";
    if (!sourceAccountId) return `Select an account to ${mode === "add" ? "transfer from" : "withdraw to"}`;
    return "";
  }

  function submit() {
    setError("");
    const value = Number(amount);
    if (!canSubmit) return setError("Enter a valid amount and select an account.");

    if (mode === "add") {
      const sourceAcc = otherAccounts.find((a) => a.id === sourceAccountId);
      if (sourceAcc && value * 100 > sourceAcc.balance) return setError("Amount exceeds account balance.");
    } else {
      if (value * 100 > goal.balance) return setError("Amount exceeds goal balance.");
    }

    saveTxn.mutate(
      {
        type: "saving",
        amount: value,
        date: new Date().toISOString(),
        note: mode === "add" ? `Saved to ${goal.name}` : `Withdrawn from ${goal.name}`,
        fromAccountId: mode === "add" ? sourceAccountId : goal.id,
        toAccountId: mode === "add" ? goal.id : sourceAccountId,
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(errMessage(e)),
      }
    );
  }

  const title = mode === "add" ? `Contribute to ${goal.name}` : `Withdraw from ${goal.name}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          <button className="btn btn-primary grow" onClick={submit} disabled={saveTxn.isPending || !canSubmit}>
            {delayedSavePending ? "Processing..." : mode === "add" ? "Confirm Savings" : "Confirm Withdrawal"}
          </button>
          {!canSubmit && !saveTxn.isPending && (
            <p className="field-hint">{getMissingHint()}</p>
          )}
        </div>
      }
    >
      <div className="goal-hero" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, margin: "10px 0 24px" }}>
        <span className="account-icon" style={{ background: `color-mix(in srgb, ${resolveThemeColor(goal.color)} 13%, transparent)`, color: resolveThemeColor(goal.color), width: 48, height: 48, fontSize: '1.4rem' }}>
          <Icon name={goal.icon} />
        </span>
      </div>

      <label className="amount-field">
        <span className="amount-symbol">{symbol}</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          autoFocus
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, "");
            const parts = val.split(".");
            setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val);
          }}
        />
      </label>

      <div className="field">
        <label className="field-label">{mode === "add" ? "From account" : "To account"}</label>
        <div className="chip-row">
          {otherAccounts.map((a) => (
            <button
              key={a.id}
              className={`chip ${sourceAccountId === a.id ? "chip-active" : ""}`}
              style={sourceAccountId === a.id ? { borderColor: resolveThemeColor(a.color), color: resolveThemeColor(a.color) } : undefined}
              onClick={() => setSourceAccountId(a.id)}
            >
              <Icon name={a.icon} /> {a.name} ({formatMoney(a.balance, user?.currency || "INR")})
            </button>
          ))}
        </div>
        {otherAccounts.length === 0 && <p className="muted small">No other accounts available.</p>}
      </div>

      {error && <p className="form-error">{error}</p>}
    </Sheet>
  );
}
