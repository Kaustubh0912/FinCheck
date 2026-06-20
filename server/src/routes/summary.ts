import { Router } from "express";
import mongoose from "mongoose";
import { Category, Transaction } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { accountsWithBalances } from "../lib/balances";

export const summaryRouter = Router();
summaryRouter.use(requireAuth);

/** Dashboard summary for a date window (defaults to the current month). */
summaryRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = req.query.from ? new Date(String(req.query.from)) : defFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : now;

  const dateRange = { $gte: from, $lte: to };
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [accounts, incomeAgg, expenseAgg, todayExpenseAgg, byCategoryRaw, categories] = await Promise.all([
    accountsWithBalances(userId),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: "income", date: dateRange } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: "expense", date: dateRange } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: "expense", date: { $gte: todayStart, $lt: todayEnd } } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: "expense", date: dateRange } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
    ]),
    Category.find({ userId }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c.toJSON()]));
  const byCategory = byCategoryRaw
    .map((row) => {
      const catIdStr = row._id?.toString();
      const cat = catIdStr ? catMap.get(catIdStr) : undefined;
      return {
        categoryId: catIdStr,
        name: cat?.name ?? "Uncategorized",
        icon: cat?.icon ?? "🔖",
        color: cat?.color ?? "#94a3b8",
        amount: row.amount ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const netWorth = accounts.filter((a) => !a.archived).reduce((sum, a) => sum + a.balance, 0);

  res.json({
    range: { from, to },
    netWorth,
    income: incomeAgg[0]?.amount ?? 0,
    expense: expenseAgg[0]?.amount ?? 0,
    todayExpense: todayExpenseAgg[0]?.amount ?? 0,
    byCategory,
    accounts,
  });
});
