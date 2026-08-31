import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts, useCategories, useTransactions, type TxnFilters } from "../api/hooks";
import { Icon } from "../lib/icons";
import { parseSmartRange } from "../lib/date";
import { TransactionItem } from "./TransactionItem";
import { Dropdown } from "./Dropdown";
import { SmartRangeInput } from "./SmartRangeInput";
import { Sheet } from "./Sheet";
import { currencySymbol, formatMoney } from "../lib/format";
import { useDelayedPending } from "../lib/useDelayedPending";
import type { Transaction, TxnType } from "../lib/types";

interface ListsSheetProps {
  open: boolean;
  onClose: () => void;
  onEdit?: (txn: Transaction) => void;
}

const TYPE_OPTIONS: { key: TxnType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expense", label: "Expense" },
  { key: "income", label: "Income" },
  { key: "transfer", label: "Transfer" },
  { key: "saving", label: "Saving" },
  { key: "reimbursement", label: "Reimburse" },
];

export function ListsSheet({ open, onClose, onEdit }: ListsSheetProps) {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const symbol = currencySymbol(currency);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<TxnType | "all">("all");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [txRangeText, setTxRangeText] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus search input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Date range parsing
  const parsedRange = useMemo(() => {
    if (!txRangeText.trim()) return null;
    return parseSmartRange(txRangeText);
  }, [txRangeText]);

  const rangeError = txRangeText.trim().length > 0 && !parsedRange;

  const minMinor = minAmount && !isNaN(Number(minAmount)) ? Math.round(Number(minAmount) * 100) : undefined;
  const maxMinor = maxAmount && !isNaN(Number(maxAmount)) ? Math.round(Number(maxAmount) * 100) : undefined;

  const filters: TxnFilters = useMemo(() => {
    return {
      q: debouncedQuery.trim() || undefined,
      type: type === "all" ? undefined : type,
      accountId: selectedAccountId || undefined,
      categoryId: selectedCategoryId || undefined,
      from: parsedRange?.from.toISOString(),
      to: parsedRange?.to.toISOString(),
      amountMin: minMinor,
      amountMax: maxMinor,
      limit: 500,
    };
  }, [debouncedQuery, type, selectedAccountId, selectedCategoryId, parsedRange, minMinor, maxMinor]);

  const { data: transactions = [], isLoading, isFetching } = useTransactions(filters, open);
  const delayedPending = useDelayedPending(isLoading || isFetching);

  const totalSum = useMemo(() => {
    return transactions.reduce(
      (sum, t) =>
        sum +
        (t.type === "income" || t.type === "reimbursement"
          ? t.amount
          : t.type === "expense"
          ? -t.amount
          : 0),
      0
    );
  }, [transactions]);

  const activeFilterCount =
    (type !== "all" ? 1 : 0) +
    (selectedAccountId ? 1 : 0) +
    (selectedCategoryId ? 1 : 0) +
    (txRangeText.trim() ? 1 : 0) +
    (minAmount.trim() ? 1 : 0) +
    (maxAmount.trim() ? 1 : 0);

  const hasAnySearchOrFilter = query.trim().length > 0 || activeFilterCount > 0;

  function handleClearAll() {
    setQuery("");
    setDebouncedQuery("");
    setType("all");
    setSelectedAccountId("");
    setSelectedCategoryId("");
    setTxRangeText("");
    setMinAmount("");
    setMaxAmount("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDebouncedQuery(query);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Advanced Search">
      <div className="sheet-body no-scrollbar">
        <form className="grid gap" onSubmit={handleSubmit}>
          {/* Main Text Search Bar */}
          <div className="search-bar-wrapper">
            <span className="search-icon-left">
              <Icon name="search" />
            </span>
            <input
              ref={searchInputRef}
              className="input search-input"
              type="text"
              placeholder="Search note or description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                }}
                aria-label="Clear search text"
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            className={`search-filter-toggle ${showFilters || activeFilterCount > 0 ? "active" : ""}`}
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <span className="search-filter-toggle-left">
              <Icon name="sliders" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </span>
            <Icon name={showFilters ? "chevron-down" : "chevron-right"} />
          </button>

          {/* Collapsible Filter Panel */}
          {showFilters && (
            <div className="search-filter-panel fade-in">
              {/* Type Filter */}
              <div className="field">
                <label className="field-label">Transaction Type</label>
                <div className="search-type-grid">
                  {TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={type === t.key ? "active" : ""}
                      onClick={() => setType(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account & Category Row */}
              <div className="search-grid-dropdowns">
                <div className="field">
                  <label className="field-label">Account</label>
                  <Dropdown
                    ariaLabel="Filter by account"
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    options={[
                      { value: "", label: "All accounts" },
                      ...accounts.map((a) => ({ value: a.id, label: a.name, icon: a.icon })),
                    ]}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Category</label>
                  <Dropdown
                    ariaLabel="Filter by category"
                    value={selectedCategoryId}
                    onChange={setSelectedCategoryId}
                    options={[
                      { value: "", label: "All categories" },
                      ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
                    ]}
                  />
                </div>
              </div>

              {/* Date Range Input */}
              <SmartRangeInput
                label="Date Range (optional)"
                value={txRangeText}
                onChange={setTxRangeText}
              />
              {rangeError && <p className="form-error">Invalid date range expression.</p>}

              {/* Amount Range */}
              <div className="field">
                <label className="field-label">Amount Range ({symbol})</label>
                <div className="search-amount-row">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input"
                    placeholder={`Min (${symbol})`}
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input"
                    placeholder={`Max (${symbol})`}
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear filters button if active */}
              {activeFilterCount > 0 && (
                <div className="search-actions-row">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: "0.82rem", padding: "6px 12px" }}
                    onClick={() => {
                      setType("all");
                      setSelectedAccountId("");
                      setSelectedCategoryId("");
                      setTxRangeText("");
                      setMinAmount("");
                      setMaxAmount("");
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Clear All when query or filters present */}
          {hasAnySearchOrFilter && !showFilters && (
            <div className="search-actions-row">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: "0.82rem", padding: "5px 12px" }}
                onClick={handleClearAll}
              >
                Clear all search & filters
              </button>
            </div>
          )}
        </form>

        {/* Results Summary Header */}
        <div className="search-results-summary">
          <span className="search-results-count">
            {delayedPending
              ? "Searching…"
              : `${transactions.length} ${transactions.length === 1 ? "result" : "results"}`}
          </span>
          {transactions.length > 0 && (
            <span
              className={`search-results-net ${
                totalSum > 0 ? "amt-income" : totalSum < 0 ? "amt-expense" : ""
              }`}
            >
              Net: {totalSum > 0 ? "+" : totalSum < 0 ? "−" : ""}
              {formatMoney(Math.abs(totalSum), currency)}
            </span>
          )}
        </div>

        {/* Results List */}
        {isLoading ? (
          <div className="loading-dots-container">
            <div className="loading-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : (
          <div className="lists-results fade-in">
            {transactions.length === 0 ? (
              <p className="muted center pad" style={{ marginTop: "24px" }}>
                {hasAnySearchOrFilter
                  ? "No transactions match your search and filters."
                  : "No transactions found."}
              </p>
            ) : (
              <div className="txn-list" style={{ marginTop: "6px" }}>
                {transactions.map((t) => (
                  <TransactionItem
                    key={t.id}
                    txn={t}
                    currency={currency}
                    onClick={() => {
                      onEdit?.(t);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

