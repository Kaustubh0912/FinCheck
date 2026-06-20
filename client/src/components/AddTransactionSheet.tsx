import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { SmartDateInput } from "./SmartDateInput";
import { Icon } from "../lib/icons";
import { useAccounts, useCategories, useSaveTransaction, useDeleteTransaction, useCreateSplit } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { currencySymbol } from "../lib/format";
import { errMessage } from "../api/client";
import type { Transaction, TxnType } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction;
}

const TYPES: { key: TxnType | "split"; label: string }[] = [
  { key: "expense", label: "Expense" },
  { key: "income", label: "Income" },
  { key: "transfer", label: "Transfer" },
  { key: "split", label: "Split" },
];

function todayInput(d?: string) {
  const date = d ? new Date(d) : new Date();
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function AddTransactionSheet({ open, onClose, editing }: Props) {
  const { user } = useAuth();
  const symbol = currencySymbol(user?.currency);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const saveTxn = useSaveTransaction();
  const deleteTxn = useDeleteTransaction();
  const createSplit = useCreateSplit();

  const [type, setType] = useState<TxnType | "split">("expense");
  const [amount, setAmount] = useState("");
  const [myShare, setMyShare] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const liveAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.type !== "savings"), [accounts]);
  const catsForType = useMemo(
    () => categories.filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [categories, type]
  );

  // (Re)initialise the form when the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount / 100));
      setMyShare("");
      setFromAccountId(editing.fromAccountId ?? "");
      setToAccountId(editing.toAccountId ?? "");
      setCategoryId(editing.categoryId ?? "");
      setDate(todayInput(editing.date));
      setNote(editing.note);
    } else {
      setType("expense");
      setAmount("");
      setMyShare("");
      const first = liveAccounts[0]?.id ?? "";
      setFromAccountId(first);
      setToAccountId(liveAccounts[1]?.id ?? "");
      setCategoryId("");
      setDate(todayInput());
      setNote("");
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Enter submits from any input; buttons keep their native Enter-to-click behavior.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "TEXTAREA") return;
      e.preventDefault();
      submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, amount, fromAccountId, toAccountId, categoryId, date, note, editing]);

  function submit() {
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) return setError("Enter an amount greater than zero.");
    
    if (type === "split") {
      const shareValue = Number(myShare);
      if (!shareValue || shareValue <= 0) return setError("Enter your share.");
      if (shareValue > value) return setError("Your share cannot be greater than the total amount.");
      if (!fromAccountId) return setError("Choose the account to take money from.");
      
      createSplit.mutate(
        {
          totalAmount: value,
          myShare: shareValue,
          fromAccountId,
          categoryId: categoryId || null,
          note: note.trim(),
          date: new Date(date + "T12:00:00").toISOString(),
        },
        {
          onSuccess: () => onClose(),
          onError: (e: any) => setError(errMessage(e)),
        }
      );
      return;
    }

    if (type !== "income" && !fromAccountId) return setError("Choose the account to take money from.");
    if (type !== "expense" && !toAccountId) return setError("Choose the account to add money to.");
    if (type === "transfer" && fromAccountId === toAccountId) return setError("Pick two different accounts.");

    saveTxn.mutate(
      {
        id: editing?.id,
        type,
        amount: value,
        date: new Date(date + "T12:00:00").toISOString(),
        note: note.trim(),
        categoryId: type === "transfer" ? null : categoryId || null,
        fromAccountId: type === "income" ? null : fromAccountId,
        toAccountId: type === "expense" ? null : toAccountId,
      },
      {
        onSuccess: () => onClose(),
        onError: (e) => setError(errMessage(e)),
      }
    );
  }

  function remove() {
    if (!editing) return;
    deleteTxn.mutate(editing.id, { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) });
  }

  const accentClass = `accent-${type}`;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "New transaction"}
      footer={
        <div className="row gap">
          {editing && (
            <button className="btn btn-ghost-danger" onClick={remove} disabled={deleteTxn.isPending}>
              <Icon name="trash" /> Delete
            </button>
          )}
          <button className={`btn btn-primary ${accentClass} grow`} onClick={submit} disabled={saveTxn.isPending || createSplit.isPending}>
            {saveTxn.isPending || createSplit.isPending ? "Saving…" : editing ? "Save changes" : "Add transaction"}
          </button>
        </div>
      }
    >
      <div className={`type-toggle ${accentClass}`}>
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={type === t.key ? "active" : ""}
            onClick={() => {
              setType(t.key);
              setCategoryId("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="amount-field">
        <span className="amount-symbol">{symbol}</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          autoFocus
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      </label>

      {type === "split" && (
        <label className="amount-field small" style={{ marginTop: -10 }}>
          <span className="muted" style={{ fontSize: "0.85rem", marginRight: 8, width: 70 }}>My share</span>
          <span className="amount-symbol">{symbol}</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={myShare}
            onChange={(e) => setMyShare(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
      )}

      {liveAccounts.length === 0 ? (
        <p className="muted center">Add an account first (Accounts tab) so transactions have somewhere to go.</p>
      ) : (
        <>
          {type === "transfer" ? (
            <div className="transfer-row">
              <AccountPicker label="From" accounts={liveAccounts} value={fromAccountId} onChange={setFromAccountId} />
              <Icon name="arrow-right" className="transfer-arrow" />
              <AccountPicker label="To" accounts={liveAccounts} value={toAccountId} onChange={setToAccountId} />
            </div>
          ) : type === "income" ? (
            <AccountPicker label="Deposit to" accounts={liveAccounts} value={toAccountId} onChange={setToAccountId} />
          ) : (
            <AccountPicker label="Paid from" accounts={liveAccounts} value={fromAccountId} onChange={setFromAccountId} />
          )}

          {type !== "transfer" && (
            <div className="field">
              <label className="field-label">Category</label>
              <div className="chip-grid">
                {catsForType.map((c) => (
                  <button
                    key={c.id}
                    className={`chip ${categoryId === c.id ? "chip-active" : ""}`}
                    style={categoryId === c.id ? { borderColor: c.color, color: c.color } : undefined}
                    onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                  >
                    <Icon name={c.icon} /> {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SmartDateInput value={date} onChange={setDate} />

      <div className="field">
        <label className="field-label">Note</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Lunch with team"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {error && <p className="form-error">{error}</p>}
    </Sheet>
  );
}

function AccountPicker({
  label,
  accounts,
  value,
  onChange,
}: {
  label: string;
  accounts: { id: string; name: string; icon: string; color: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <div className="chip-row">
        {accounts.map((a) => (
          <button
            key={a.id}
            className={`chip ${value === a.id ? "chip-active" : ""}`}
            style={value === a.id ? { borderColor: a.color, color: a.color } : undefined}
            onClick={() => onChange(a.id)}
          >
            <Icon name={a.icon} /> {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
