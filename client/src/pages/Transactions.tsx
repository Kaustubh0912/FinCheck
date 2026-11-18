import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  useAccounts,
  useCategories,
  useInfiniteTransactions,
  type InfiniteTxnFilters,
} from "../api/hooks";
import { TransactionItem } from "../components/TransactionItem";
import { AddTransactionSheet } from "../components/AddTransactionSheet";
import { Dropdown, type DropdownOption } from "../components/Dropdown";
import { SmartRangeInput } from "../components/SmartRangeInput";
import { Icon } from "../lib/icons";
import { parseSmartRange, toYmd } from "../lib/date";
import { currencySymbol, dayKey, formatDayHeading, formatMoney } from "../lib/format";
import type { Transaction, TxnType } from "../lib/types";

const TYPE_FILTERS: { key: TxnType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expense", label: "Expense" },
  { key: "income", label: "Income" },
  { key: "transfer", label: "Transfer" },
  { key: "saving", label: "Saving" },
  { key: "reimbursement", label: "Reimburse" },
];

type DatePreset = "all" | "this_month" | "last_30_days" | "this_year" | "custom";

const DATE_PRESET_OPTIONS: DropdownOption[] = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range…" },
];

function getPresetRange(preset: DatePreset): { from?: string; to?: string } {
  const now = new Date();
  if (preset === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "last_30_days") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "this_year") {
    const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return {};
}

function detectDatePreset(fromStr: string, toStr: string): DatePreset {
  if (!fromStr && !toStr) return "all";
  const fromD = new Date(fromStr);
  const toD = new Date(toStr);
  if (isNaN(fromD.getTime()) || isNaN(toD.getTime())) return "custom";

  const now = new Date();
  // Check this_month
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  if (
    Math.abs(fromD.getTime() - startMonth.getTime()) < 5000 &&
    Math.abs(toD.getTime() - endMonth.getTime()) < 5000
  ) {
    return "this_month";
  }

  // Check this_year
  const startYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  if (
    Math.abs(fromD.getTime() - startYear.getTime()) < 5000 &&
    Math.abs(toD.getTime() - endYear.getTime()) < 5000
  ) {
    return "this_year";
  }

  // Check last_30_days (today plus preceding 29 days)
  const start30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
  const end30 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (
    Math.abs(fromD.getTime() - start30.getTime()) < 5000 &&
    Math.abs(toD.getTime() - end30.getTime()) < 5000
  ) {
    return "last_30_days";
  }

  return "custom";
}

export function Transactions() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const symbol = currencySymbol(currency);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters
  const urlQuery = searchParams.get("q") ?? "";
  const type = (searchParams.get("type") as TxnType | "all") || "all";
  const accountId = searchParams.get("accountId") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const urlFrom = searchParams.get("from") ?? "";
  const urlTo = searchParams.get("to") ?? "";
  const legacyRange = searchParams.get("range") ?? "";
  const minAmount = searchParams.get("amountMin") ?? "";
  const maxAmount = searchParams.get("amountMax") ?? "";

  // Local text input state for snappy typing
  const [query, setQuery] = useState(urlQuery);
  const [minAmountInput, setMinAmountInput] = useState(minAmount);
  const [maxAmountInput, setMaxAmountInput] = useState(maxAmount);
  const [customRangeText, setCustomRangeText] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showAmountInputs, setShowAmountInputs] = useState(Boolean(minAmount || maxAmount));
  const [editing, setEditing] = useState<Transaction | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Backward compatibility: migrate legacy ?range= to canonical ?from=&to=
  useEffect(() => {
    if (!urlFrom && !urlTo && legacyRange) {
      const parsed = parseSmartRange(legacyRange);
      if (parsed) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("from", parsed.from.toISOString());
            next.set("to", parsed.to.toISOString());
            next.delete("range");
            return next;
          },
          { replace: true }
        );
      }
    }
  }, [urlFrom, urlTo, legacyRange, setSearchParams]);

  // Sync local text input when URL query changes externally (e.g. browser Back/Forward)
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Sync amount inputs when URL parameters change externally
  useEffect(() => {
    setMinAmountInput(minAmount);
  }, [minAmount]);

  useEffect(() => {
    setMaxAmountInput(maxAmount);
  }, [maxAmount]);

  // Sync custom date range text when URL from/to changes externally
  useEffect(() => {
    if (urlFrom && urlTo) {
      const preset = detectDatePreset(urlFrom, urlTo);
      if (preset === "custom") {
        setShowCustomDate(true);
        const f = new Date(urlFrom);
        const t = new Date(urlTo);
        if (!isNaN(f.getTime()) && !isNaN(t.getTime())) {
          setCustomRangeText(`${toYmd(f)} .. ${toYmd(t)}`);
        }
      } else {
        setShowCustomDate(false);
        setCustomRangeText("");
      }
    } else {
      setShowCustomDate(false);
      setCustomRangeText("");
    }
  }, [urlFrom, urlTo]);

  // Keep amount input visibility open if amounts exist
  useEffect(() => {
    if (minAmount || maxAmount) {
      setShowAmountInputs(true);
    }
  }, [minAmount, maxAmount]);

  // Debounce typing into the URL query with { replace: true }
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const trimmed = query.trim();
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          if (next.get("q") === prev.get("q")) return prev;
          return next;
        },
        { replace: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query, setSearchParams]);

  // Debounce amount inputs into URL parameters with { replace: true }
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const minTrimmed = minAmountInput.trim();
          const maxTrimmed = maxAmountInput.trim();

          if (minTrimmed) next.set("amountMin", minTrimmed);
          else next.delete("amountMin");

          if (maxTrimmed) next.set("amountMax", maxTrimmed);
          else next.delete("amountMax");

          if (
            next.get("amountMin") === prev.get("amountMin") &&
            next.get("amountMax") === prev.get("amountMax")
          ) {
            return prev;
          }
          return next;
        },
        { replace: true }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [minAmountInput, maxAmountInput, setSearchParams]);

  const activeDatePreset = useMemo<DatePreset>(() => {
    return detectDatePreset(urlFrom, urlTo);
  }, [urlFrom, urlTo]);

  // Debounce typing in custom date range input with { replace: true }
  useEffect(() => {
    if (!showCustomDate && activeDatePreset !== "custom") return;
    const timer = setTimeout(() => {
      const trimmed = customRangeText.trim();
      if (!trimmed) {
        setSearchParams(
          (prev) => {
            if (!prev.has("from") && !prev.has("to")) return prev;
            const next = new URLSearchParams(prev);
            next.delete("from");
            next.delete("to");
            return next;
          },
          { replace: true }
        );
        return;
      }
      const parsed = parseSmartRange(trimmed);
      if (parsed) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            const fromIso = parsed.from.toISOString();
            const toIso = parsed.to.toISOString();
            if (next.get("from") === fromIso && next.get("to") === toIso) return prev;
            next.set("from", fromIso);
            next.set("to", toIso);
            return next;
          },
          { replace: true }
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customRangeText, showCustomDate, activeDatePreset, setSearchParams]);

  // Global search shortcut listener
  useEffect(() => {
    const handleOpenSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("fincheck:open-search", handleOpenSearch);
    return () => window.removeEventListener("fincheck:open-search", handleOpenSearch);
  }, []);

  function updateFilter(
    key: string,
    value: string,
    options: { replace?: boolean } = { replace: false }
  ) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== "all") {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        return next;
      },
      { replace: options.replace ?? false }
    );
  }

  function updateMultipleFilters(
    updates: Record<string, string | null | undefined>,
    options: { replace?: boolean } = { replace: false }
  ) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v && v !== "all") {
            next.set(k, v);
          } else {
            next.delete(k);
          }
        }
        return next;
      },
      { replace: options.replace ?? false }
    );
  }

  function handleDatePresetChange(val: string) {
    if (val === "custom") {
      setShowCustomDate(true);
      return;
    }
    setShowCustomDate(false);
    setCustomRangeText("");
    const range = getPresetRange(val as DatePreset);
    if (!range.from && !range.to) {
      updateMultipleFilters({ from: null, to: null }, { replace: false });
    } else {
      updateMultipleFilters({ from: range.from, to: range.to }, { replace: false });
    }
  }

  function handleCustomRangeChange(text: string) {
    setCustomRangeText(text);
  }

  function handleResetFilters() {
    setQuery("");
    setCustomRangeText("");
    setMinAmountInput("");
    setMaxAmountInput("");
    setShowCustomDate(false);
    setShowAmountInputs(false);
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  const minMinor = minAmount && !isNaN(Number(minAmount)) ? Math.round(Number(minAmount) * 100) : undefined;
  const maxMinor = maxAmount && !isNaN(Number(maxAmount)) ? Math.round(Number(maxAmount) * 100) : undefined;

  const filters: InfiniteTxnFilters = useMemo(
    () => ({
      q: urlQuery.trim() || undefined,
      type: type === "all" ? undefined : type,
      accountId: accountId || undefined,
      categoryId: categoryId || undefined,
      from: urlFrom || undefined,
      to: urlTo || undefined,
      amountMin: minMinor,
      amountMax: maxMinor,
    }),
    [urlQuery, type, accountId, categoryId, urlFrom, urlTo, minMinor, maxMinor]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteTransactions(filters, 40);

  // Flatten and deduplicate by transaction ID
  const txns = useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.items) ?? [];
    const seen = new Set<string>();
    const deduped: Transaction[] = [];
    for (const t of raw) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        deduped.push(t);
      }
    }
    return deduped;
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount;

  // Group continuous days
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of txns) {
      const key = dayKey(t.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [txns]);

  // Active filter count (excluding query)
  const activeFilterCount =
    (type !== "all" ? 1 : 0) +
    (accountId ? 1 : 0) +
    (categoryId ? 1 : 0) +
    (urlFrom || urlTo ? 1 : 0) +
    (minAmount.trim() ? 1 : 0) +
    (maxAmount.trim() ? 1 : 0);

  const hasAnyFilter = Boolean(urlQuery.trim()) || activeFilterCount > 0;

  // Calculate net monetary flow across loaded items
  const loadedNet = useMemo(() => {
    return txns.reduce(
      (sum, t) =>
        sum +
        (t.type === "income" || t.type === "reimbursement"
          ? t.amount
          : t.type === "expense"
          ? -t.amount
          : 0),
      0
    );
  }, [txns]);

  const countForPlural = totalCount !== undefined ? totalCount : txns.length;
  const txnNoun = countForPlural === 1 ? "transaction" : "transactions";

  return (
    <div className="page">
      <header className="page-head">
        <h1>Activity</h1>
      </header>

      {/* Integrated Search Bar */}
      <div className="search-bar-wrapper">
        <span className="search-icon-left" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input
          ref={searchInputRef}
          className="input search-input"
          type="search"
          placeholder="Search notes or descriptions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search transactions"
        />
        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => {
              setQuery("");
              updateFilter("q", "", { replace: true });
            }}
            aria-label="Clear search text"
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      {/* Horizontal Type Filter Strip */}
      <div className="search-type-strip" role="group" aria-label="Transaction type filter">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`search-type-chip ${type === t.key ? "active" : ""}`}
            onClick={() => updateFilter("type", t.key, { replace: false })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Visible Horizontal Filter Bar */}
      <div className="search-filter-bar">
        {/* Account Dropdown */}
        <div className="filter-bar-item">
          <Dropdown
            ariaLabel="Filter by account"
            value={accountId}
            onChange={(val) => updateFilter("accountId", val, { replace: false })}
            options={[
              { value: "", label: "All accounts" },
              ...accounts.map((a) => ({ value: a.id, label: a.name, icon: a.icon })),
            ]}
          />
        </div>

        {/* Category Dropdown */}
        <div className="filter-bar-item">
          <Dropdown
            ariaLabel="Filter by category"
            value={categoryId}
            onChange={(val) => updateFilter("categoryId", val, { replace: false })}
            options={[
              { value: "", label: "All categories" },
              ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
            ]}
          />
        </div>

        {/* Date Preset Dropdown */}
        <div className="filter-bar-item">
          <Dropdown
            ariaLabel="Filter by date range"
            value={activeDatePreset}
            onChange={handleDatePresetChange}
            options={DATE_PRESET_OPTIONS}
          />
        </div>

        {/* Amount Range Chip */}
        <button
          type="button"
          className={`btn-filter-chip ${minAmountInput || maxAmountInput || showAmountInputs ? "active" : ""}`}
          onClick={() => setShowAmountInputs((prev) => !prev)}
          aria-expanded={showAmountInputs}
        >
          <Icon name="sliders" />
          <span>
            {minAmountInput || maxAmountInput
              ? `${minAmountInput ? `${symbol}${minAmountInput}` : `${symbol}0`} – ${maxAmountInput ? `${symbol}${maxAmountInput}` : "∞"}`
              : "Amount"}
          </span>
        </button>

        {/* One-click Reset Button */}
        {hasAnyFilter && (
          <button
            type="button"
            className="btn-filter-clear"
            onClick={handleResetFilters}
            aria-label="Reset all search and filters"
          >
            <Icon name="close" />
            <span>Reset</span>
            {activeFilterCount > 0 && (
              <span className="filter-clear-badge">{activeFilterCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Secondary Panel: Custom Date Range & Amount Bounds */}
      {(showCustomDate || activeDatePreset === "custom" || showAmountInputs || minAmountInput || maxAmountInput) && (
        <div className="search-secondary-panel fade-in">
          {(showCustomDate || activeDatePreset === "custom") && (
            <SmartRangeInput
              label="Custom Date Range (e.g. 1.1..t or 1.11..30.11)"
              value={customRangeText}
              onChange={handleCustomRangeChange}
            />
          )}

          {(showAmountInputs || minAmountInput || maxAmountInput) && (
            <div className="field">
              <label className="field-label">Amount Range ({symbol})</label>
              <div className="search-amount-row">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input"
                  placeholder={`Min (${symbol})`}
                  value={minAmountInput}
                  onChange={(e) => setMinAmountInput(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input"
                  placeholder={`Max (${symbol})`}
                  value={maxAmountInput}
                  onChange={(e) => setMaxAmountInput(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary Header */}
      {hasAnyFilter && (
        <div className="search-results-summary">
          <span className="search-results-count">
            Showing {txns.length}
            {totalCount !== undefined ? ` of ${totalCount}` : ""}{" "}
            {txnNoun}
          </span>
          {txns.length > 0 && (
            <span
              className={`search-results-net ${
                loadedNet > 0 ? "amt-income" : loadedNet < 0 ? "amt-expense" : ""
              }`}
            >
              {hasNextPage ? "Loaded net: " : "Net: "}
              {loadedNet > 0 ? "+" : loadedNet < 0 ? "−" : ""}
              {formatMoney(Math.abs(loadedNet), currency)}
            </span>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="loading-dots-container">
          <div className="loading-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : groups.length === 0 ? (
        <p className="muted center pad">
          {hasAnyFilter
            ? "No transactions match your search and filters."
            : "No transactions yet. Tap the + button to add your first one."}
        </p>
      ) : (
        <div className="fade-in">
          {groups.map(([day, items]) => {
            const dayTotal = items.reduce(
              (sum, t) =>
                sum +
                (t.type === "income" || t.type === "reimbursement"
                  ? t.amount
                  : t.type === "expense"
                  ? -t.amount
                  : 0),
              0
            );
            return (
              <section key={day} className="day-group">
                <div className="day-head">
                  <span>{formatDayHeading(day)}</span>
                  {dayTotal !== 0 && (
                    <span className={dayTotal > 0 ? "amt-income" : "amt-expense"}>
                      {dayTotal > 0 ? "+" : "−"}
                      {formatMoney(Math.abs(dayTotal), currency)}
                    </span>
                  )}
                </div>
                <div className="txn-list">
                  {items.map((t) => (
                    <TransactionItem
                      key={t.id}
                      txn={t}
                      currency={currency}
                      onClick={() => setEditing(t)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {hasNextPage && (
            <div className="load-more-wrap" style={{ margin: "24px 0 32px", textAlign: "center" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                style={{
                  minWidth: "190px",
                  margin: "0 auto",
                  padding: "10px 18px",
                  fontSize: "0.9rem",
                }}
              >
                {isFetchingNextPage ? (
                  <span>Loading older transactions…</span>
                ) : (
                  <span>Load older transactions</span>
                )}
              </button>
              {totalCount !== undefined && (
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: "8px" }}>
                  Showing {txns.length} of {totalCount} {txnNoun}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Direct Edit / Add Modal */}
      <AddTransactionSheet
        open={!!editing}
        editing={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
