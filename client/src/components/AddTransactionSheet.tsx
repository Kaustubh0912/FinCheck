import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { SmartDateInput } from "./SmartDateInput";
import { Icon } from "../lib/icons";
import { useAccounts, useCategories, useSaveTransaction, useDeleteTransaction, useCreateSplit } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { currencySymbol } from "../lib/format";
import { resolveThemeColor } from "../lib/colors";
import { errMessage } from "../api/client";
import type { Transaction, TxnType } from "../lib/types";
import { CharCount } from "./CharCount";
import { useDelayedPending } from "../lib/useDelayedPending";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Transaction;
}

const TYPES: { key: TxnType | "split"; label: string; icon: string }[] = [
  { key: "expense", label: "Expense", icon: "arrow-up" },
  { key: "income", label: "Income", icon: "arrow-down" },
  { key: "transfer", label: "Transfer", icon: "arrow-right-arrow-left" },
  { key: "split", label: "Split", icon: "scissors" },
];

function todayInput(d?: string) {
  const date = d ? new Date(d) : new Date();
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function AddTransactionSheet({ open, onClose, editing }: Props) {
  const formId = useId();
  const { user } = useAuth();
  const symbol = currencySymbol(user?.currency);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const saveTxn = useSaveTransaction();
  const deleteTxn = useDeleteTransaction();
  const createSplit = useCreateSplit();

  const isSaving = saveTxn.isPending || createSplit.isPending;
  const delayedSavePending = useDelayedPending(isSaving);

  const [type, setType] = useState<TxnType | "split">("expense");
  const [amount, setAmount] = useState("");
  const [myShare, setMyShare] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "unequal">("unequal");
  const [numPeople, setNumPeople] = useState(2);
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [excludeFromBudget, setExcludeFromBudget] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const liveAccounts = useMemo(() => accounts.filter((a) => !a.archived && a.type !== "savings"), [accounts]);
  const catsForType = useMemo(
    () => categories.filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [categories, type]
  );

  const numAmount = Number(amount);
  const hasAmount = !isNaN(numAmount) && numAmount > 0;
  const hasAccount =
    type === "income" || type === "reimbursement"
      ? !!toAccountId
      : type === "expense" || type === "saving" || type === "split"
      ? !!fromAccountId
      : type === "transfer"
      ? !!fromAccountId && !!toAccountId && fromAccountId !== toAccountId
      : false;

  const canSubmit = hasAmount && hasAccount;

  function getMissingHint() {
    if (!hasAmount) return "Enter an amount greater than zero";
    if (type === "transfer" && fromAccountId === toAccountId) return "Select two different accounts";
    if (!hasAccount) return "Select an account";
    return "";
  }

  // (Re)initialise the form when the sheet opens.
  useEffect(() => {
    if (!open) return;
    setSavedMessage("");
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount / 100));
      setMyShare("");
      setFromAccountId(editing.fromAccountId ?? "");
      setToAccountId(editing.toAccountId ?? "");
      setCategoryId(editing.categoryId ?? "");
      setDate(todayInput(editing.date));
      setNote(editing.note);
      setExcludeFromBudget(editing.excludeFromBudget ?? false);
    } else {
      setType("expense");
      setAmount("");
      setMyShare("");
      setSplitMode("unequal");
      setNumPeople(2);
      const first = liveAccounts[0]?.id ?? "";
      setFromAccountId(first);
      setToAccountId(liveAccounts[1]?.id ?? "");
      setCategoryId("");
      setDate(todayInput());
      setNote("");
      setExcludeFromBudget(false);
    }
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!savedMessage) return;
    const timeout = window.setTimeout(() => setSavedMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [savedMessage]);

  function handleSaved() {
    setSavedMessage(editing ? "Changes saved" : type === "split" ? "Split added" : "Transaction added");
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) return setError("Enter an amount greater than zero.");

    if (type === "split") {
      let shareValue: number;
      if (splitMode === "equal") {
        shareValue = Math.round((value / numPeople) * 100) / 100;
      } else {
        shareValue = Number(myShare);
        if (myShare.trim() === "" || isNaN(shareValue) || shareValue < 0) return setError("Enter your share.");
      }
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
          excludeFromBudget,
        },
        {
          onSuccess: handleSaved,
          onError: (e: unknown) => setError(errMessage(e)),
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
        excludeFromBudget,
      },
      {
        onSuccess: handleSaved,
        onError: (e) => setError(errMessage(e)),
      }
    );
  }

  function remove() {
    if (!editing) return;
    deleteTxn.mutate(editing.id, { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) });
  }

  const accentClass = `accent-${type}`;

  /* ── Main form ── */
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? "Edit transaction" : "New transaction"}
        footer={
          <>
            <div className="txn-footer">
              {editing && (
                <button type="button" className="btn btn-ghost-danger" onClick={remove} disabled={deleteTxn.isPending}>
                  <Icon name="trash" /> Delete
                </button>
              )}
              <button type="submit" form={formId} className={`btn btn-primary ${accentClass} grow`} disabled={isSaving}>
                {delayedSavePending ? "Saving…" : editing ? "Save changes" : "Add transaction"}
              </button>
            </div>
            {!canSubmit && !isSaving && (
              <p className="field-hint">{getMissingHint()}</p>
            )}
          </>
        }
      >
        <form id={formId} className="transaction-form" onSubmit={submit}>
          {error && <p className="field-hint txn-error" role="alert">{error}</p>}
          {/* Type selector */}
          <div className={`txn-type-bar ${accentClass}`}>
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.key}
                className={`txn-type-btn ${type === t.key ? "active" : ""}`}
                onClick={() => {
                  setType(t.key);
                  setCategoryId("");
                }}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div className="txn-amount-block">
            <span className="txn-amount-currency">{symbol}</span>
            <input
              className="txn-amount-input"
              aria-label="Amount"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              size={amount.length || 1}
              autoFocus
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, "");
                const parts = val.split(".");
                setAmount(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val);
              }}
            />
          </div>

          {/* Transaction fields */}
          <div className="txn-fields">
            {/* Split options */}
            {type === "split" && (
              <div className="txn-section">
                <div className="txn-split-toggle">
                  <button
                    type="button"
                    className={splitMode === "equal" ? "active" : ""}
                    onClick={() => setSplitMode("equal")}
                  >
                    <Icon name="equals" /> Equal
                  </button>
                  <button
                    type="button"
                    className={splitMode === "unequal" ? "active" : ""}
                    onClick={() => setSplitMode("unequal")}
                  >
                    <Icon name="sliders" /> Unequal
                  </button>
                </div>

                {splitMode === "equal" ? (
                  <div className="txn-stepper-field">
                    <label className="field-label">Number of people (including you)</label>
                    <div className="txn-stepper">
                      <button
                        type="button"
                        className="txn-stepper-btn"
                        onClick={() => setNumPeople((n) => Math.max(2, n - 1))}
                        disabled={numPeople <= 2}
                      >
                        <Icon name="minus" />
                      </button>
                      <span className="txn-stepper-count">{numPeople}</span>
                      <button type="button" className="txn-stepper-btn" onClick={() => setNumPeople((n) => n + 1)}>
                        <Icon name="plus" />
                      </button>
                    </div>
                    {amount && Number(amount) > 0 && (
                      <div className="txn-share-badge">
                        Your share: {symbol}{(Number(amount) / numPeople).toFixed(2)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="txn-my-share">
                    <label className="field-label">My share</label>
                    <div className="txn-share-input-row">
                      <span className="txn-share-symbol">{symbol}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={myShare}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          const parts = val.split(".");
                          setMyShare(parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account picker(s) */}
            {liveAccounts.length === 0 ? (
              <p className="txn-empty-hint">Add an account first (Accounts tab) so transactions have somewhere to go.</p>
            ) : (
              <>
                {type === "transfer" ? (
                  <div className="txn-transfer-row">
                    <AccountPicker label="From" accounts={liveAccounts} value={fromAccountId} onChange={setFromAccountId} />
                    <div className="txn-transfer-arrow">
                      <Icon name="arrow-right" />
                    </div>
                    <AccountPicker label="To" accounts={liveAccounts} value={toAccountId} onChange={setToAccountId} />
                  </div>
                ) : type === "income" ? (
                  <AccountPicker label="Deposit to" accounts={liveAccounts} value={toAccountId} onChange={setToAccountId} />
                ) : (
                  <AccountPicker label="Paid from" accounts={liveAccounts} value={fromAccountId} onChange={setFromAccountId} />
                )}

                {type !== "transfer" && catsForType.length > 0 && (
                  <div className="field">
                    <label className="field-label">Category</label>
                    <div className="txn-chip-grid">
                      {catsForType.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          className={`chip ${categoryId === c.id ? "chip-active" : ""}`}
                          style={categoryId === c.id ? { borderColor: resolveThemeColor(c.color), color: resolveThemeColor(c.color) } : undefined}
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
          </div>

          {/* Date */}
          <SmartDateInput value={date} onChange={setDate} />

          {/* Note */}
          <div className="field">
            <div className="field-header">
              <label className="field-label" htmlFor="transaction-note">Note</label>
              <CharCount current={note.length} max={200} />
            </div>
            <input
              type="text"
              id="transaction-note"
              className="input"
              placeholder="e.g. Lunch with team"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Exclude from budget toggle */}
          {(type === "expense" || type === "saving" || type === "split") && (
            <label className="txn-toggle">
              <div className="txn-toggle-text">
                <span>Exclude from budget</span>
                <span className="txn-toggle-hint">Don&apos;t count this against daily/monthly allowance</span>
              </div>
              <input
                type="checkbox"
                checked={excludeFromBudget}
                onChange={(e) => setExcludeFromBudget(e.target.checked)}
              />
            </label>
          )}
        </form>
      </Sheet>
      {savedMessage && <div className="txn-toast" role="status">{savedMessage}</div>}
    </>
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
      <div className="txn-chip-scroll">
        {accounts.map((a) => (
          <button
            type="button"
            key={a.id}
            className={`chip ${value === a.id ? "chip-active" : ""}`}
            style={value === a.id ? { borderColor: resolveThemeColor(a.color), color: resolveThemeColor(a.color) } : undefined}
            onClick={() => onChange(a.id)}
          >
            <Icon name={a.icon} /> {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
