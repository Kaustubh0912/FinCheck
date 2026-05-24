import { prisma } from "../db";

export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  color: string;
  icon: string;
  archived: boolean;
  createdAt: Date;
  balance: number;
}

/** Compute live balances for all of a user's accounts. */
export async function accountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
  const [accounts, inflow, outflow] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.transaction.groupBy({
      by: ["toAccountId"],
      where: { userId, type: { in: ["income", "transfer"] }, toAccountId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["fromAccountId"],
      where: { userId, type: { in: ["expense", "transfer"] }, fromAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const inMap = new Map(inflow.map((r) => [r.toAccountId as string, r._sum.amount ?? 0]));
  const outMap = new Map(outflow.map((r) => [r.fromAccountId as string, r._sum.amount ?? 0]));

  return accounts.map((a) => ({
    ...a,
    balance: a.openingBalance + (inMap.get(a.id) ?? 0) - (outMap.get(a.id) ?? 0),
  }));
}
