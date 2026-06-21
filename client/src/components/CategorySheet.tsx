import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { IconPicker } from "./IconPicker";
import { Icon } from "../lib/icons";
import { useSaveCategory, useDeleteCategory } from "../api/hooks";
import { errMessage } from "../api/client";
import { resolveThemeColor } from "../lib/colors";
import type { Category, CategoryKind } from "../lib/types";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#14b8a6", "#64748b"];

export function CategorySheet({
  open,
  onClose,
  editing,
  defaultKind = "expense",
}: {
  open: boolean;
  onClose: () => void;
  editing?: Category;
  defaultKind?: CategoryKind;
}) {
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>(defaultKind);
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setIcon(editing.icon);
      setColor(editing.color);
    } else {
      setName("");
      setKind(defaultKind);
      setIcon("tag");
      setColor(COLORS[0]);
    }
    setError("");
  }, [open, editing, defaultKind]);

  function submit() {
    if (!name.trim()) return setError("Name the category.");
    save.mutate(
      { id: editing?.id, name: name.trim(), kind, icon, color },
      { onSuccess: () => onClose(), onError: (e) => setError(errMessage(e)) }
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit category" : "New category"}
      footer={
        <div className="row gap">
          {editing && (
            <button
              className="btn btn-ghost-danger"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this category?")) {
                  del.mutate(editing.id, { onSuccess: onClose, onError: (e) => setError(errMessage(e)) });
                }
              }}
              disabled={del.isPending}
            >
              <Icon name="trash" /> Delete
            </button>
          )}
          <button className="btn btn-primary grow" onClick={submit} disabled={save.isPending}>
            {editing ? "Save" : "Create"}
          </button>
        </div>
      }
    >
      <div className="type-toggle">
        <button className={kind === "expense" ? "active" : ""} onClick={() => setKind("expense")}>
          Expense
        </button>
        <button className={kind === "income" ? "active" : ""} onClick={() => setKind("income")}>
          Income
        </button>
      </div>

      <div className="field">
        <label className="field-label">Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Coffee" autoFocus />
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
              style={{ background: resolveThemeColor(c) }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
    </Sheet>
  );
}
