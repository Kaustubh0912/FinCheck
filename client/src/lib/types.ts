export type AccountType = "bank" | "cash" | "card" | "wallet" | "investment" | "savings" | "other";
export type TxnType = "income" | "expense" | "transfer" | "saving" | "reimbursement";
export type CategoryKind = "income" | "expense";

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  monthlyBudget?: number | null;
}

export interface Split {
  id: string;
  transactionId: string;
  totalAmount: number;      // minor units
  myShare: number;          // minor units
  splitNote: string;
  settled: boolean;
  settledAmount: number;    // minor units
  createdAt: string;
  transaction?: Transaction; // populated
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number; // minor units
  goalTarget: number | null; // minor units
  color: string;
  icon: string;
  archived: boolean;
  createdAt: string;
  balance: number; // minor units, computed by the server
  order: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
}

export interface AccountRef {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface CategoryRef extends AccountRef {
  kind: CategoryKind;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number; // minor units
  date: string;
  note: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  fromAccount: AccountRef | null;
  toAccount: AccountRef | null;
  category: CategoryRef | null;
  createdAt: string;
}

export interface Summary {
  range: { from: string; to: string };
  netWorth: number;
  income: number;
  expense: number;
  byCategory: { categoryId: string | null; name: string; icon: string; color: string; amount: number }[];
  accounts: Account[];
}

export interface TransactionInput {
  type: TxnType;
  amount: number; // major units
  date?: string;
  note?: string;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
}
