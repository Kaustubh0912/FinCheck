import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PillNav } from "./PillNav";
import { SideNav } from "./SideNav";
import { AddTransactionSheet } from "./AddTransactionSheet";

export function Layout({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const openAdd = useCallback(() => setAddOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.key || "").toLowerCase() !== "t") return;
      e.preventDefault();
      setAddOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app-shell">
      <SideNav onAdd={openAdd} />
      <main className="app-content">{children}</main>
      <PillNav onAdd={openAdd} />
      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
