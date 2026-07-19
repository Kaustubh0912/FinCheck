import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../lib/icons";

interface ShortcutCardProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Alt + 1", desc: "Home" },
  { key: "Alt + 2", desc: "Budget" },
  { key: "Alt + 3", desc: "Activity" },
  { key: "Alt + 4", desc: "Splits" },
  { key: "Alt + 5", desc: "Accounts" },
  { key: "Alt + 6", desc: "Settings" },
  { key: "Alt + T", desc: "Add Transaction" },
  { key: "Alt + F", desc: "Search & Filter" },
  { key: "Alt + /", desc: "Toggle this card" },
  { key: "Esc", desc: "Close modal / sheet" },
];

const SHEET_SHORTCUTS = [
  { key: "Alt + 1-4", desc: "Switch type" },
  { key: "Alt + S", desc: "Submit" },
  { key: "Alt + A", desc: "Add another (on success)" },
  { key: "Alt + D", desc: "Done (on success)" },
];

export function ShortcutCard({ open, onClose }: ShortcutCardProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-card-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close shortcuts">
            <Icon name="close" />
          </button>
        </div>
        
        <div className="shortcut-grid">
          {SHORTCUTS.map((sc) => {
            const keys = sc.key.split(" + ");
            return (
              <div key={sc.key} className="shortcut-row">
                <span className="shortcut-desc">{sc.desc}</span>
                <span className="shortcut-keys">
                  {keys.map((k, i) => (
                    <span key={i}>
                      <kbd>{k}</kbd>
                      {i < keys.length - 1 && <span className="shortcut-plus">+</span>}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        <h3 className="shortcut-card-subheader">Inside Add Transaction</h3>
        <div className="shortcut-grid">
          {SHEET_SHORTCUTS.map((sc) => {
            const keys = sc.key.split(" + ");
            return (
              <div key={sc.key} className="shortcut-row">
                <span className="shortcut-desc">{sc.desc}</span>
                <span className="shortcut-keys">
                  {keys.map((k, i) => (
                    <span key={i}>
                      <kbd>{k}</kbd>
                      {i < keys.length - 1 && <span className="shortcut-plus">+</span>}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
