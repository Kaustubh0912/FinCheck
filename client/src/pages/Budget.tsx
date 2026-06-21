import { useState, useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { useSummary } from "../api/hooks";
import { formatMoney, monthRange } from "../lib/format";
import { BudgetWidget } from "../components/BudgetWidget";

export function Budget() {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [monthDate] = useState(new Date());
  const range = useMemo(() => monthRange(monthDate), [monthDate]);
  
  const { data: summary } = useSummary(range);
  
  const [checkAmount, setCheckAmount] = useState("");
  const [showConsequence, setShowConsequence] = useState(false);

  const handleCheck = () => {
    const amt = parseFloat(checkAmount);
    if (isNaN(amt) || amt <= 0) {
      setShowConsequence(false);
      return;
    }
    setShowConsequence(true);
  };

  const expense = summary?.expense ?? 0;
  const todayExpense = summary?.todayExpense ?? 0;
  const monthlyBudget = user?.monthlyBudget ?? 0;
  const netWorth = summary?.netWorth ?? 0;

  const renderConsequencePanel = () => {
    if (!showConsequence || !monthlyBudget) return null;

    const amt = parseFloat(checkAmount);
    if (isNaN(amt) || amt <= 0) return null;

    const enteredAmountInMinorUnits = Math.round(amt * 100);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const currentDay = now.getDate();
    const daysLeft = totalDays - currentDay + 1;

    const monthExpenseBeforeToday = Math.max(0, expense - todayExpense);
    const todaysBudget = Math.max(0, (monthlyBudget - monthExpenseBeforeToday) / daysLeft);
    const leftToday = todaysBudget - todayExpense;

    const newLeftToday = leftToday - enteredAmountInMinorUnits;
    const newMonthLeft = monthlyBudget - expense - enteredAmountInMinorUnits;
    const pctMonthlyBudget = (enteredAmountInMinorUnits / monthlyBudget) * 100;

    let verdict = "";
    let verdictClass = "";

    if (newLeftToday >= 0 && newMonthLeft >= 0 && pctMonthlyBudget < 15) {
      verdict = "✅ Yes, you can afford this";
      verdictClass = "green";
    } else if (newMonthLeft >= 0 && (newLeftToday < 0 || pctMonthlyBudget >= 15)) {
      verdict = "⚠️ Afford it, but it'll cost you";
      verdictClass = "amber";
    } else {
      verdict = "❌ This would put you over budget";
      verdictClass = "red";
    }

    // Row 1
    const r1Label = "Today's headroom";
    const r1Value = newLeftToday >= 0 
      ? `${formatMoney(newLeftToday, currency)} left for today` 
      : `${formatMoney(Math.abs(newLeftToday), currency)} over today's limit`;
    const r1Status = newLeftToday >= 0 ? "green" : "red";

    // Row 2
    const r2Label = "Monthly budget";
    const r2Value = newMonthLeft >= 0
      ? `${formatMoney(newMonthLeft, currency)} left for the month`
      : `${formatMoney(Math.abs(newMonthLeft), currency)} over monthly budget`;
    const r2Detail = `${pctMonthlyBudget.toFixed(1)}% of monthly budget`;
    const pctMonthRemaining = newMonthLeft > 0 ? (newMonthLeft / monthlyBudget) * 100 : 0;
    const r2Status = newMonthLeft < 0 ? "red" : pctMonthRemaining > 10 ? "green" : "amber";

    // Row 3
    const r3Label = "Ripple on remaining days";
    const newDailyBudget = daysLeft - 1 > 0 ? Math.max(0, newMonthLeft / (daysLeft - 1)) : 0;
    const diffDaily = todaysBudget - newDailyBudget;
    const r3Value = `Daily allowance drops from ${formatMoney(todaysBudget, currency)} to ${formatMoney(newDailyBudget, currency)}`;
    const r3Detail = `${formatMoney(diffDaily, currency)} less per day`;
    // threshold logic based on major units (rupees)
    const diffDailyMajor = diffDaily / 100;
    const r3Status = diffDailyMajor > 500 ? "red" : diffDailyMajor >= 200 ? "amber" : "green";

    // Row 4
    const r4Label = "Net worth impact";
    const newNetWorth = netWorth - enteredAmountInMinorUnits;
    const pctNetWorth = netWorth > 0 ? (enteredAmountInMinorUnits / netWorth) * 100 : 0;
    const r4Value = `Balance ${formatMoney(netWorth, currency)} → ${formatMoney(newNetWorth, currency)}`;
    const r4Detail = `${pctNetWorth.toFixed(1)}% of total balance`;
    const r4Status = pctNetWorth > 5 ? "red" : pctNetWorth >= 1 ? "amber" : "green";

    return (
      <div className="consequence-panel">
        <div className={`verdict-banner ${verdictClass}`}>
          {verdict}
        </div>
        
        <div className="consequence-row">
          <div className="consequence-info">
            <span className="consequence-label">{r1Label}</span>
            <span className="consequence-value">{r1Value}</span>
          </div>
          <span className={`status-pill ${r1Status}`}>{r1Status === "green" ? "GOOD" : "OVER"}</span>
        </div>

        <div className="consequence-row">
          <div className="consequence-info">
            <span className="consequence-label">{r2Label}</span>
            <span className="consequence-value">{r2Value}</span>
            <span className="consequence-detail">{r2Detail}</span>
          </div>
          <span className={`status-pill ${r2Status}`}>{r2Status === "green" ? "GOOD" : r2Status === "amber" ? "LOW" : "OVER"}</span>
        </div>

        <div className="consequence-row">
          <div className="consequence-info">
            <span className="consequence-label">{r3Label}</span>
            <span className="consequence-value">{r3Value}</span>
            <span className="consequence-detail">{r3Detail}</span>
          </div>
          <span className={`status-pill ${r3Status}`}>{r3Status === "green" ? "OKAY" : r3Status === "amber" ? "WARN" : "OUCH"}</span>
        </div>

        <div className="consequence-row">
          <div className="consequence-info">
            <span className="consequence-label">{r4Label}</span>
            <span className="consequence-value">{r4Value}</span>
            <span className="consequence-detail">{r4Detail}</span>
          </div>
          <span className={`status-pill ${r4Status}`}>{r4Status === "green" ? "SAFE" : r4Status === "amber" ? "NOTICE" : "HIGH"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="page budget">
      <header className="page-head">
        <div>
          <h1>Budget</h1>
        </div>
      </header>

      <BudgetWidget 
        expense={expense} 
        todayExpense={todayExpense}
        monthlyBudget={monthlyBudget > 0 ? monthlyBudget : undefined} 
      />

      <section className="card">
        <h2 className="card-title">Can I afford this?</h2>
        <div className="amount-field small">
          <span className="amount-symbol">₹</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={checkAmount}
            onChange={(e) => {
              setCheckAmount(e.target.value);
              setShowConsequence(false);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
            style={{ fontSize: "1.25rem" }}
          />
          <button className="btn btn-pill sm" onClick={handleCheck} style={{ marginLeft: 8, flexShrink: 0 }}>
            Check
          </button>
        </div>

        {renderConsequencePanel()}
      </section>
    </div>
  );
}
