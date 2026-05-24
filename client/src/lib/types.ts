export type AccountType = "bank" | "cash" | "card" | "wallet" | "investment" | "other";
export type TxnType = "income" | "expense" | "transfer";
export type CategoryKind = "income" | "expense";

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number; // minor units
  color: string;
  icon: string;
  archived: boolean;
  createdAt: string;
  balance: number; // minor units, computed by the server
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
