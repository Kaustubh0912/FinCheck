import { formatMoney } from "../lib/format";
import { Icon } from "../lib/icons";
import type { Transaction } from "../lib/types";

export function TransactionItem({
  txn,
  currency,
  onClick,
}: {
  txn: Transaction;
  currency: string;
  onClick?: () => void;
}) {
  const isTransfer = txn.type === "transfer";
  const isSaving = txn.type === "saving";
  const isIncome = txn.type === "income";
  const isReimbursement = txn.type === "reimbursement";

  const iconName = isSaving ? "piggy" : (isTransfer || isReimbursement) ? "transfer" : txn.category?.icon ?? (isIncome ? "sack" : "tag");
  const title =
    txn.note ||
    (isSaving ? "Saving" : isTransfer ? "Transfer" : isReimbursement ? "Reimbursement" : txn.category?.name ?? (isIncome ? "Income" : "Expense"));

  const subtitle = (isTransfer || isSaving) ? (
    <>
      {txn.fromAccount?.name ?? "?"} <Icon name="arrow-right" /> {txn.toAccount?.name ?? "?"}
    </>
  ) : (isIncome || isReimbursement) ? (
    `to ${txn.toAccount?.name ?? "?"}`
  ) : (
    `from ${txn.fromAccount?.name ?? "?"}`
  );

  const sign = isIncome ? "+" : (isTransfer || isSaving || isReimbursement) ? "" : "−";
  const amountClass = isIncome ? "amt-income" : (isTransfer || isSaving || isReimbursement) ? "amt-transfer" : "amt-expense";

  return (
    <button className="txn" onClick={onClick}>
      <span className={`txn-icon ${amountClass}-bg`}>
        <Icon name={iconName} />
      </span>
      <span className="txn-main">
        <span className="txn-title">{title}</span>
        <span className="txn-sub">
          {subtitle}
          {txn.excludeFromBudget && (
            <span className="off-budget-badge">
              <Icon name="eye-off" /> Off-budget
            </span>
          )}
        </span>
      </span>
      <span className={`txn-amount ${amountClass}`}>
        {sign}
        {formatMoney(txn.amount, currency)}
      </span>
    </button>
  );
}
