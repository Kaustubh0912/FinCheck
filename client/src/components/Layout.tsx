import { useState, type ReactNode } from "react";
import { PillNav } from "./PillNav";
import { AddTransactionSheet } from "./AddTransactionSheet";

export function Layout({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="app-shell">
      <main className="app-content">{children}</main>
      <PillNav onAdd={() => setAddOpen(true)} />
      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
