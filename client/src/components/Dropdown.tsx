import { useEffect, useRef, useState } from "react";
import { Icon } from "../lib/icons";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

/** A styled select that can render an icon per option (native <select> can't). */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`dropdown ${open ? "open" : ""}`} ref={ref}>
      <button
        type="button"
        className="dropdown-trigger input"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dropdown-value">
          {selected?.icon && <Icon name={selected.icon} />}
          {selected?.label}
        </span>
        <Icon name="chevron-down" className="dropdown-caret" />
      </button>

      {open && (
        <ul className="dropdown-menu" role="listbox">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`dropdown-item ${o.value === value ? "active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.icon ? <Icon name={o.icon} /> : <span className="dropdown-bullet" />}
                <span className="dropdown-item-label">{o.label}</span>
                {o.value === value && <Icon name="check" className="dropdown-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
