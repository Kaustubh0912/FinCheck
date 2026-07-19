import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { SmartDateInput } from "./SmartDateInput";
import { Icon } from "../lib/icons";
import { useAccounts, useCategories, useSaveTransaction, useDeleteTransaction, useCreateSplit } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { currencySymbol } from "../lib/format";
import { resolveThemeColor } from "../lib/colors";
import { errMessage } from "../api/client";
import type { Transaction, TxnType } from "../lib/types";

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
  const [splitMode, setSplitMode] = useState<"equal" | "unequal">("unequal");
  const [numPeople, setNumPeople] = useState(2);
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(todayInput());
  const [note, setNote] = useState("");
  const [excludeFromBudget, setExcludeFromBudget] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
    setSuccess(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keydown listener on document (capture phase to beat global hooks).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // In-sheet Alt shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        let handled = false;
        switch (e.code) {
          case "Digit1":
          case "Numpad1":
            setType("expense");
            setCategoryId("");
            handled = true;
            break;
          case "Digit2":
          case "Numpad2":
            setType("income");
            setCategoryId("");
            handled = true;
            break;
          case "Digit3":
          case "Numpad3":
            setType("transfer");
            setCategoryId("");
            handled = true;
            break;
          case "Digit4":
          case "Numpad4":
            setType("split");
            setCategoryId("");
            handled = true;
            break;
          case "KeyS":
            if (!(saveTxn.isPending || createSplit.isPending)) submit();
            handled = true;
            break;
          case "KeyA":
            if (success && !editing) {
              setSuccess(false);
              setAmount("");
              setNote("");
            }
            handled = true;
            break;
          case "KeyD":
            if (success) onClose();
            handled = true;
            break;
        }
        if (handled) {
          e.preventDefault();
          e.stopPropagation(); // Stop global hook
          return;
        }
      }

      // Enter submits from any input; buttons keep their native Enter-to-click behavior.
      if (e.key !== "Enter" || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "BUTTON" || tag === "TEXTAREA") return;
      if (saveTxn.isPending || createSplit.isPending) return;
      e.preventDefault();
      submit();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, amount, fromAccountId, toAccountId, categoryId, date, note, excludeFromBudget, editing, splitMode, numPeople, myShare, saveTxn.isPending, createSplit.isPending, success]);

  function submit() {
    setError("");
    const value = Number(amount);
    if (!value || value <= 0) return setError("Enter an amount greater than zero.");
    
    if (type === "split") {
      let shareValue: number;
      if (splitMode === "equal") {
        shareValue = Math.round((value / numPeople) * 100) / 100;
      } else {
        shareValue = Number(myShare);
        if (!shareValue || shareValue <= 0) return setError("Enter your share.");
      }
      if (shareValue > value) return setError("Your share cannot be greater than the total amount.");
      if (!fromAccountId) return setError("Choose the account to take money from.");
      
      const sourceAcc = liveAccounts.find((a) => a.id === fromAccountId);
      if (sourceAcc && value * 100 > sourceAcc.balance) return setError("Amount exceeds account balance.");

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
          onSuccess: () => setSuccess(true),
          onError: (e: unknown) => setError(errMessage(e)),
        }
      );
      return;
    }

    if (type !== "income" && !fromAccountId) return setError("Choose the account to take money from.");
    if (type !== "expense" && !toAccountId) return setError("Choose the account to add money to.");
    if (type === "transfer" && fromAccountId === toAccountId) return setError("Pick two different accounts.");

    if (type !== "income") {
      const sourceAcc = liveAccounts.find((a) => a.id === fromAccountId);
      const effectiveBalance = sourceAcc
        ? sourceAcc.balance + (editing && editing.fromAccountId === fromAccountId ? editing.amount : 0)
        : 0;
      if (sourceAcc && value * 100 > effectiveBalance) {
        return setError("Amount exceeds account balance.");
      }
    }

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
        onSuccess: () => setSuccess(true),
        onError: (e) => setError(errMessage(e)),
      }
    );
  }

  function remove() {
    if (!editing) return;
    deleteTxn.mutate(editing.id, { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) });
  }

  const accentClass = `accent-${type}`;

  /* ── Feedback screen (success / error) ── */
  if (success || error) {
    return (
      <Sheet open={open} onClose={onClose} title={editing ? "Edit transaction" : "New transaction"}>
        <div className="txn-feedback">
          <div className={`txn-feedback-icon ${success ? "is-success" : "is-error"}`}>
            <Icon name={success ? "circle-check" : "circle-xmark"} />
          </div>
          <h2 className="txn-feedback-title">
            {success ? (editing ? "Changes saved" : "Transaction added") : "Issue detected"}
          </h2>
          <p className="txn-feedback-msg">
            {success ? "Your transaction has been successfully recorded." : error}
          </p>
          <div className="txn-feedback-actions">
            {success && !editing && (
              <button className="btn btn-ghost" onClick={() => { setSuccess(false); setAmount(""); setNote(""); }}>
                Add another
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={success ? onClose : () => setError("")}
            >
              {success ? "Done" : "Try again"}
            </button>
          </div>
        </div>
        {success && (
          <div className="txn-shortcut-hints">
            <span><kbd>Alt</kbd>+<kbd>A</kbd> Add another</span>
            <span><kbd>Alt</kbd>+<kbd>D</kbd> Done</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
        )}
      </Sheet>
    );
  }

  /* ── Main form ── */
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "New transaction"}
      footer={
        <>
          <div className="txn-footer">
            {editing && (
              <button className="btn btn-ghost-danger" onClick={remove} disabled={deleteTxn.isPending}>
                <Icon name="trash" /> Delete
              </button>
            )}
            <button className={`btn btn-primary ${accentClass} grow`} onClick={submit} disabled={saveTxn.isPending || createSplit.isPending}>
              {saveTxn.isPending || createSplit.isPending ? "Saving…" : editing ? "Save changes" : "Add transaction"}
            </button>
          </div>
          <div className="txn-shortcut-hints">
            <span><kbd>Alt</kbd>+<kbd>1‑4</kbd> Type</span>
            <span><kbd>Alt</kbd>+<kbd>S</kbd> Submit</span>
            <span><kbd>Enter</kbd> Submit</span>
          </div>
        </>
      }
    >
      {/* Type selector */}
      <div className={`txn-type-bar ${accentClass}`}>
        {TYPES.map((t) => (
          <button
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

      {/* Dynamic fields — wrapped for smooth height + fade animation */}
      <AnimatedContent depKey={type === "split" ? `${type}-${splitMode}` : type}>
        {/* Split options */}
        {type === "split" && (
          <div className="txn-section">
            <div className="txn-split-toggle">
              <button
                className={splitMode === "equal" ? "active" : ""}
                onClick={() => setSplitMode("equal")}
              >
                <Icon name="equals" /> Equal
              </button>
              <button
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
                    className="txn-stepper-btn"
                    onClick={() => setNumPeople((n) => Math.max(2, n - 1))}
                    disabled={numPeople <= 2}
                  >
                    <Icon name="minus" />
                  </button>
                  <span className="txn-stepper-count">{numPeople}</span>
                  <button className="txn-stepper-btn" onClick={() => setNumPeople((n) => n + 1)}>
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
      </AnimatedContent>

      {/* Date */}
      <SmartDateInput value={date} onChange={setDate} />

      {/* Note */}
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
    </Sheet>
  );
}

/**
 * Smoothly animates height changes and fades content in when `depKey` changes.
 * Uses ResizeObserver for rock-solid height tracking, preventing clipping bugs.
 */
function AnimatedContent({ children, depKey }: { children: React.ReactNode; depKey: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const obs = new ResizeObserver(() => {
      outer.style.height = `${inner.offsetHeight}px`;
    });
    
    obs.observe(inner);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="txn-animated-outer"
      style={{ transition: "height 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <div ref={innerRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div key={depKey} className="txn-animated-inner">
          {children}
        </div>
      </div>
    </div>
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
