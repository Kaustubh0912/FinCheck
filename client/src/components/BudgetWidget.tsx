import { useState, useEffect } from "react";
import { formatMoney } from "../lib/format";
import { useAuth } from "../auth/AuthContext";

interface BudgetWidgetProps {
  expense: number; // minor units
  monthlyBudget: number | null | undefined; // minor units
}

export function BudgetWidget({ expense, monthlyBudget }: BudgetWidgetProps) {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";
  const [checkAmount, setCheckAmount] = useState("");
  const [checkResult, setCheckResult] = useState<"YES" | "NO" | null>(null);

  // Clear check result after 4 seconds
  useEffect(() => {
    if (checkResult) {
      const timer = setTimeout(() => {
        setCheckResult(null);
        setCheckAmount("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [checkResult]);

  if (!monthlyBudget) {
    return null;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const currentDay = now.getDate();
  
  const daysLeft = totalDays - currentDay + 1; // including today
  const daysElapsed = currentDay;
  
  const remaining = monthlyBudget - expense;
  const dailyAllowance = Math.max(0, remaining / daysLeft);
  
  const pctSpent = Math.min(100, (expense / monthlyBudget) * 100);
  const isDanger = pctSpent > 80;

  // Burn rate calc
  const expectedSpend = (monthlyBudget / totalDays) * daysElapsed;
  const isOverPace = expense > expectedSpend;
  const paceDiff = Math.abs(expense - expectedSpend);

  const handleCheck = () => {
    const amt = parseFloat(checkAmount);
    if (isNaN(amt) || amt <= 0) return;
    
    // compare in minor units
    if (Math.round(amt * 100) <= dailyAllowance) {
      setCheckResult("YES");
    } else {
      setCheckResult("NO");
    }
  };

  return (
    <section className="card budget-widget">
      <div className="card-head">
        <h2 className="card-title">Allowance</h2>
        <span className="muted date-hint">{daysLeft} days left</span>
      </div>

      <div className="budget-hero">
        <div className="budget-allowance serif">
          {formatMoney(dailyAllowance, currency)} <span className="budget-per-day muted">/ day</span>
        </div>
      </div>

      <div className="bd-track">
        <div 
          className="bd-fill" 
          style={{ 
            width: `${pctSpent}%`, 
            backgroundColor: isDanger ? "var(--expense)" : "var(--income)" 
          }} 
        />
      </div>

      <div className="budget-meta">
        {isOverPace ? (
          <span className="amt-expense">
            At this rate you'll overspend by {formatMoney((expense / daysElapsed) * totalDays - monthlyBudget, currency)} this month
          </span>
        ) : (
          <span className="muted">
            You're {formatMoney(paceDiff, currency)} under pace
          </span>
        )}
      </div>

      <div className="budget-check">
        {!checkResult ? (
          <div className="budget-check-input">
            <span className="muted">How much is it?</span>
            <div className="row gap" style={{ marginTop: 6 }}>
              <input 
                type="number" 
                className="input sm" 
                placeholder="₹" 
                value={checkAmount} 
                onChange={(e) => setCheckAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCheck();
                }}
              />
              <button className="btn btn-pill" onClick={handleCheck}>Check</button>
            </div>
          </div>
        ) : (
          <div className="budget-check-result">
            <div className={`budget-check-answer serif ${checkResult === "YES" ? "amt-income" : "amt-expense"}`}>
              {checkResult}
            </div>
            <div className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
              You have {formatMoney(dailyAllowance, currency)}/day left with {daysLeft} days to go
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
