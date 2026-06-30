import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useCategories, useTransactions } from "../api/hooks";
import { Icon } from "../lib/icons";
import { parseSmartRange } from "../lib/date";
import { TransactionItem } from "./TransactionItem";
import { Dropdown } from "./Dropdown";
import { SmartRangeInput } from "./SmartRangeInput";
import { Sheet } from "./Sheet";
import { formatMoney } from "../lib/format";
import { Skeleton } from "boneyard-js/react";
import type { Transaction } from "../lib/types";

interface ListsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ListsSheet({ open, onClose }: ListsSheetProps) {
  const { user } = useAuth();
  const { data: categories = [] } = useCategories();
  const currency = user?.currency ?? "INR";

  const isBoneyard = typeof window !== "undefined" && (window as any).__BONEYARD_BUILD;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [txRangeText, setTxRangeText] = useState("1..t");
  const [params, setParams] = useState<{ from: string; to: string; categoryId?: string } | null>(isBoneyard ? { from: "", to: "" } : null);
  const [error, setError] = useState("");

  const { data: transactions = [], isLoading } = useTransactions(
    params ? { ...params, limit: 500 } : { limit: 0 }
  );

  const totalSum = transactions.reduce(
    (sum, t) => sum + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0),
    0
  );

  function handleSearch() {
    const range = parseSmartRange(txRangeText);
    if (!range) {
      setError("Enter a valid period, e.g. 1.1..t");
      return;
    }
    setError("");
    setParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      categoryId: selectedCategoryId || undefined,
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Advanced Search">
      <div className="sheet-body no-scrollbar">
        <form
          className="grid gap"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div className="field">
            <label className="field-label">Category</label>
            <Dropdown
              ariaLabel="Select category"
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              options={[
                { value: "", label: "All categories" },
                ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
              ]}
            />
          </div>
          <SmartRangeInput value={txRangeText} onChange={setTxRangeText} />
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            <Icon name={isLoading ? "activity" : "search"} className={isLoading ? "fa-spin" : ""} />
            {isLoading ? "Searching…" : "Search"}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        <Skeleton 
          name="lists-sheet-results"
          loading={isLoading}
          fixture={
            <div className="lists-results">
              <div className="stat-card" style={{ borderTop: "1px solid var(--line)", marginTop: "24px", paddingTop: "20px" }}>
                <span className="stat-label">Net Total</span>
                <span className="stat-value" style={{ fontSize: "1.8rem" }}>100</span>
              </div>
              <div className="txn-list" style={{ marginTop: "10px" }}>
                <TransactionItem txn={{ id: "f1", amount: 100, type: "expense", date: new Date().toISOString(), categoryId: null, fromAccountId: null, toAccountId: null, note: "Loading...", excludeFromBudget: false, createdAt: new Date().toISOString() } as unknown as Transaction} currency={currency} />
                <TransactionItem txn={{ id: "f2", amount: 100, type: "expense", date: new Date().toISOString(), categoryId: null, fromAccountId: null, toAccountId: null, note: "Loading...", excludeFromBudget: false, createdAt: new Date().toISOString() } as unknown as Transaction} currency={currency} />
              </div>
            </div>
          }
        >
          {params && (
            <div className="lists-results">
              <div
                className="stat-card"
                style={{ borderTop: "1px solid var(--line)", marginTop: "24px", paddingTop: "20px" }}
              >
                <span className="stat-label">Net Total</span>
                <span
                  className={`stat-value ${totalSum > 0 ? "amt-income" : totalSum < 0 ? "amt-expense" : ""}`}
                  style={{ fontSize: "1.8rem" }}
                >
                  {totalSum > 0 ? "+" : totalSum < 0 ? "−" : ""}
                  {formatMoney(Math.abs(totalSum), currency)}
                </span>
              </div>
              <div className="txn-list" style={{ marginTop: "10px" }}>
                {transactions.length === 0 ? (
                  <p className="muted center pad">No transactions found for this period.</p>
                ) : (
                  transactions.map((t) => <TransactionItem key={t.id} txn={t} currency={currency} />)
                )}
              </div>
            </div>
          )}
        </Skeleton>
      </div>
    </Sheet>
  );
}
