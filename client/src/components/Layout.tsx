import { useCallback, useState, type ReactNode } from "react";
import { PillNav } from "./PillNav";
import { SideNav } from "./SideNav";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { useKeyboardNav } from "../lib/useKeyboardNav";
import { ShortcutCard } from "./ShortcutCard";
import { Icon } from "../lib/icons";

export function Layout({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const openAdd = useCallback(() => setAddOpen(true), []);
  const toggleShortcuts = useCallback(() => setShortcutsOpen(prev => !prev), []);

  useKeyboardNav({
    onAddTransaction: openAdd,
    onToggleShortcuts: toggleShortcuts
  });

  return (
    <div className="app-shell">
      <SideNav onAdd={openAdd} />
      <main className="app-content">{children}</main>
      <PillNav onAdd={openAdd} />
      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <ShortcutCard open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <button className="shortcut-trigger" onClick={toggleShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (Alt + /)">
        <Icon name="keyboard" />
      </button>
    </div>
  );
}
