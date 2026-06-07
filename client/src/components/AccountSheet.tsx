import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { IconPicker } from "./IconPicker";
import { useSaveAccount, useDeleteAccount } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { currencySymbol } from "../lib/format";
import { Icon, accountTypeIcon } from "../lib/icons";
import { errMessage } from "../api/client";
import type { Account, AccountType } from "../lib/types";

const TYPES: { key: AccountType; label: string; icon: string }[] = [
  { key: "bank", label: "Bank", icon: "bank" },
  { key: "cash", label: "Cash", icon: "cash" },
  { key: "card", label: "Card", icon: "card" },
  { key: "wallet", label: "Wallet", icon: "wallet" },
  { key: "investment", label: "Invest", icon: "invest" },
  { key: "savings", label: "Savings", icon: "piggy" },
  { key: "other", label: "Other", icon: "box" },
];

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#14b8a6", "#64748b"];

export function AccountSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Account }) {
  const { user } = useAuth();
  const symbol = currencySymbol(user?.currency);
  const save = useSaveAccount();
  const del = useDeleteAccount();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [icon, setIcon] = useState("bank");
  const [color, setColor] = useState(COLORS[0]);
  const [openingBalance, setOpeningBalance] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setIcon(editing.icon);
      setColor(editing.color);
      setOpeningBalance(String(editing.openingBalance / 100));
      setGoalTarget(editing.goalTarget ? String(editing.goalTarget / 100) : "");
      setArchived(editing.archived);
    } else {
      setName("");
      setType("bank");
      setIcon("bank");
      setColor(COLORS[0]);
      setOpeningBalance("");
      setGoalTarget("");
      setArchived(false);
    }
    setError("");
  }, [open, editing]);

  function submit() {
    setError("");
    if (!name.trim()) return setError("Give the account a name.");
    save.mutate(
      {
        id: editing?.id,
        name: name.trim(),
        type,
        icon,
        color,
        openingBalance: Number(openingBalance) || 0,
        goalTarget: goalTarget ? Number(goalTarget) : null,
        ...(editing ? { archived } : {}),
      },
      { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) }
    );
  }

  function remove() {
    if (!editing) return;
    del.mutate(editing.id, { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit account" : "New account"}
      footer={
        <div className="row gap">
          {editing && (
            <button className="btn btn-ghost-danger" onClick={remove} disabled={del.isPending}>
              <Icon name="trash" /> Delete
            </button>
          )}
          <button className="btn btn-primary grow" onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create account"}
          </button>
        </div>
      }
    >
      <div className="field">
        <label className="field-label">Name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bank ****7512"
          autoFocus
        />
      </div>

      <div className="field">
        <label className="field-label">Type</label>
        <div className="chip-grid">
          {TYPES.map((t) => (
            <button
              key={t.key}
              className={`chip ${type === t.key ? "chip-active" : ""}`}
              onClick={() => {
                setType(t.key);
                if (!editing) setIcon(accountTypeIcon(t.key));
              }}
            >
              <Icon name={t.icon} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Opening balance</label>
        <div className="amount-field small">
          <span className="amount-symbol">{symbol}</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value.replace(/[^0-9.-]/g, ""))}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">Goal target (Optional)</label>
        <div className="amount-field small">
          <span className="amount-symbol">{symbol}</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="No goal set"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value.replace(/[^0-9.-]/g, ""))}
          />
        </div>
        <p className="date-hint">Set a target balance to track your savings progress.</p>
      </div>

      <div className="field">
        <label className="field-label">Icon</label>
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </div>

      <div className="field">
        <label className="field-label">Colour</label>
        <div className="swatch-row">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? "swatch-active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
      </div>

      {editing && (
        <label className="toggle-row">
          <span>Archived (hidden from new transactions)</span>
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
        </label>
      )}

      {error && <p className="form-error">{error}</p>}
    </Sheet>
  );
}
