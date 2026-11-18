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
    <section
      className="card budget-widget"
      data-status={isDangerToday ? "danger" : "safe"}
      data-pace={isOverPace ? "over" : "under"}
    >
      <h2 className="card-title">Allowance</h2>

      <div className="budget-hero">
        <div className="budget-allowance serif">
          {formatMoney(todaysBudget, currency)}
          <span className="budget-per-day muted"> / day</span>
        </div>
        <span className="date-hint">{daysLeft} days left in {now.toLocaleString('default', { month: 'long' })}</span>
      </div>

      <meter
        className="budget-meter"
        min={0}
        max={Math.max(1, todaysBudget)}
        value={Math.min(todayExpense, Math.max(1, todaysBudget))}
        low={todaysBudget * 0.75}
        high={todaysBudget}
        optimum={0}
        aria-label="Daily spending allowance"
        aria-valuetext={`${formatMoney(todayExpense, currency)} spent of ${formatMoney(todaysBudget, currency)} daily allowance${isDangerToday ? `, ${formatMoney(Math.abs(leftToday), currency)} over budget` : `, ${formatMoney(leftToday, currency)} left`}`}
      >
        {pctSpentToday}%
      </meter>

      <div className="budget-meta budget-meta-split">
        <span>
          <span className="budget-spent-val">{formatMoney(todayExpense, currency)}</span> spent today
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

      <div className="budget-meta budget-pace">
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
