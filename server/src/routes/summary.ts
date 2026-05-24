import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { accountsWithBalances } from "../lib/balances";

export const summaryRouter = Router();
summaryRouter.use(requireAuth);

/** Dashboard summary for a date window (defaults to the current month). */
summaryRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = req.query.from ? new Date(String(req.query.from)) : defFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : now;

  const dateRange = { gte: from, lte: to };

  const [accounts, incomeAgg, expenseAgg, byCategoryRaw, categories] = await Promise.all([
    accountsWithBalances(userId),
    prisma.transaction.aggregate({ where: { userId, type: "income", date: dateRange }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, type: "expense", date: dateRange }, _sum: { amount: true } }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "expense", date: dateRange },
      _sum: { amount: true },
    }),
    prisma.category.findMany({ where: { userId } }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byCategory = byCategoryRaw
    .map((row) => {
      const cat = row.categoryId ? catMap.get(row.categoryId) : undefined;
      return {
        categoryId: row.categoryId,
        name: cat?.name ?? "Uncategorized",
        icon: cat?.icon ?? "🔖",
        color: cat?.color ?? "#94a3b8",
        amount: row._sum.amount ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const netWorth = accounts.filter((a) => !a.archived).reduce((sum, a) => sum + a.balance, 0);

  res.json({
    range: { from, to },
    netWorth,
    income: incomeAgg._sum.amount ?? 0,
    expense: expenseAgg._sum.amount ?? 0,
    byCategory,
    accounts,
  });
});
