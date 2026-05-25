import { useState, type ReactNode } from "react";
import { PillNav } from "./PillNav";
import { SideNav } from "./SideNav";
import { AddTransactionSheet } from "./AddTransactionSheet";

export function Layout({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const openAdd = () => setAddOpen(true);

  return (
    <div className="app-shell">
      <SideNav onAdd={openAdd} />
      <main className="app-content">{children}</main>
      <PillNav onAdd={openAdd} />
      <AddTransactionSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
