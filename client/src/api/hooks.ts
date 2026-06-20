import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Account, Category, Summary, Transaction, TransactionInput } from "../lib/types";

// ---- Accounts ----
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts")).data,
  });
}

export interface AccountInput {
  name: string;
  type: string;
  openingBalance: number;
  goalTarget: number | null;
  color: string;
  icon: string;
  archived?: boolean;
}

export function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AccountInput> & { id?: string }) =>
      id
        ? (await api.patch<Account>(`/accounts/${id}`, data)).data
        : (await api.post<Account>("/accounts", data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

export function useReorderAccounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; order: number }[]) =>
      await api.patch("/accounts/reorder", { updates }),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ["accounts"] });
      const previousAccounts = qc.getQueryData<Account[]>(["accounts"]);
      return { previousAccounts };
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

// ---- Categories ----
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<Category[]>("/categories")).data,
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Category> & { id?: string }) =>
      id
        ? (await api.patch<Category>(`/categories/${id}`, data)).data
        : (await api.post<Category>("/categories", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// ---- Transactions ----
export interface TxnFilters {
  from?: string;
  to?: string;
  accountId?: string;
  type?: string;
  categoryId?: string;
  limit?: number;
}

export function useTransactions(filters: TxnFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""));
      return (await api.get<Transaction[]>("/transactions", { params })).data;
    },
  });
}

function invalidateMoney(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["transactions"] });
  qc.invalidateQueries({ queryKey: ["accounts"] });
  qc.invalidateQueries({ queryKey: ["summary"] });
}

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: TransactionInput & { id?: string }) =>
      id
        ? (await api.patch<Transaction>(`/transactions/${id}`, data)).data
        : (await api.post<Transaction>("/transactions", data)).data,
    onSuccess: () => invalidateMoney(qc),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => invalidateMoney(qc),
  });
}

// ---- Summary ----
export function useSummary(range?: { from: string; to: string }) {
  const params: any = { ...range };
  
  // Pass the client's local midnight to the server for accurate todayExpense calculation
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  params.todayStart = todayStart.toISOString();

  return useQuery({
    queryKey: ["summary", range],
    queryFn: async () =>
      (await api.get<Summary>("/summary", { params })).data,
  });
}

// ---- Splits ----
export function useSplits(settled?: boolean) {
  return useQuery({
    queryKey: ["splits", settled],
    queryFn: async () => {
      const params = settled !== undefined ? { settled } : undefined;
      const res = await api.get<import("../lib/types").Split[]>("/splits", { params });
      return res.data;
    },
  });
}

export function useCreateSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { totalAmount: number; myShare: number; fromAccountId: string; categoryId?: string | null; note?: string; date?: string }) => {
      const res = await api.post("/splits", data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splits"] });
      invalidateMoney(qc);
    },
  });
}

export function useRepaySplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, toAccountId }: { id: string; amount: number; toAccountId: string }) => {
      const res = await api.post(`/splits/${id}/repay`, { amount, toAccountId });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["splits"] });
      invalidateMoney(qc);
    },
  });
}
