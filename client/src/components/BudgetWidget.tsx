import { formatMoney } from "../lib/format";
import { useAuth } from "../auth/AuthContext";

interface BudgetWidgetProps {
  expense: number; // minor units
  todayExpense: number; // minor units
  monthlyBudget: number | null | undefined; // minor units
}

export function BudgetWidget({ expense, todayExpense, monthlyBudget }: BudgetWidgetProps) {
  const { user } = useAuth();
  const currency = user?.currency ?? "INR";

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
  
  // Stable daily budget calculation
  const monthExpenseBeforeToday = Math.max(0, expense - todayExpense);
  const todaysBudget = Math.max(0, (monthlyBudget - monthExpenseBeforeToday) / daysLeft);
  const leftToday = todaysBudget - todayExpense;
  
  const pctSpentToday = todaysBudget > 0 ? Math.min(100, Math.max(0, (todayExpense / todaysBudget) * 100)) : 100;
  const isDangerToday = leftToday < 0;

  // Burn rate calc
  const expectedSpend = (monthlyBudget / totalDays) * daysElapsed;
  const isOverPace = expense > expectedSpend;
  const paceDiff = Math.abs(expense - expectedSpend);

  return (
    <section className="card budget-widget">
      <h2 className="card-title">Allowance</h2>

      <div className="budget-hero">
        <div className="budget-allowance serif">
          {formatMoney(todaysBudget, currency)}
          <span className="budget-per-day muted"> / day</span>
        </div>
        <span className="date-hint" style={{ marginTop: 2 }}>{daysLeft} days left in {now.toLocaleString('default', { month: 'long' })}</span>
      </div>

      <div className="bd-track">
        <div 
          className="bd-fill" 
          style={{ 
            width: `${pctSpentToday}%`, 
            backgroundColor: isDangerToday ? "var(--expense)" : "var(--income)" 
          }} 
        />
      </div>

      <div className="budget-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          <span style={{ fontWeight: 500 }}>{formatMoney(todayExpense, currency)}</span> spent today
        </span>
        {isDangerToday ? (
          <span className="amt-expense">
            {formatMoney(Math.abs(leftToday), currency)} over budget
          </span>
        ) : (
          <span className="amt-income">
            {formatMoney(leftToday, currency)} left
          </span>
        )}
      </div>

      <div className="budget-meta" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line-light)' }}>
        {isOverPace ? (
          <span className="amt-expense">
            At this rate you&apos;ll overspend by {formatMoney((expense / daysElapsed) * totalDays - monthlyBudget, currency)} this month
          </span>
        ) : (
          <span className="muted">
            You&apos;re {formatMoney(paceDiff, currency)} under pace
          </span>
        )}
      </div>
    </section>
  );
}
