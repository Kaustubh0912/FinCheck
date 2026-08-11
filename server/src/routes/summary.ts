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
  let todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (req.query.todayStart) {
    todayStart = new Date(String(req.query.todayStart));
  }
  const todayEnd = new Date(todayStart.getTime() + 86400000);

  const [accounts, incomeAgg, [spending], categories] = await Promise.all([
    accountsWithBalances(userId),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["income", "reimbursement"] }, date: dateRange } },
      { $group: { _id: null, amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, date: { $gte: new Date(Math.min(from.getTime(), todayStart.getTime())), $lte: new Date(Math.max(to.getTime(), todayEnd.getTime())) } } },
      { $lookup: { from: "Split", localField: "_id", foreignField: "transactionId", as: "_split" } },
      { $set: { effectiveAmount: { $ifNull: [{ $arrayElemAt: ["$_split.myShare", 0] }, "$amount"] } } },
      { $facet: {
        expense: [{ $match: { type: "expense", date: dateRange, excludeFromBudget: { $ne: true } } }, { $group: { _id: null, amount: { $sum: "$effectiveAmount" } } }],
        todayExpense: [{ $match: { type: "expense", date: { $gte: todayStart, $lt: todayEnd }, excludeFromBudget: { $ne: true } } }, { $group: { _id: null, amount: { $sum: "$effectiveAmount" } } }],
        byCategory: [{ $match: { type: "expense", date: dateRange, excludeFromBudget: { $ne: true } } }, { $group: { _id: "$categoryId", amount: { $sum: "$effectiveAmount" } } }],
        investment: [{ $match: { type: { $in: ["expense", "saving"] }, date: dateRange, excludeFromBudget: true } }, { $group: { _id: null, amount: { $sum: "$effectiveAmount" } } }],
      } },
    ]),
    Category.find({ userId }),
  ]);

  // Opening balance: mirror the exact same logic as accountsWithBalances()
  // but only count transactions with date < from (i.e. before the period).
  // Closing balance: same logic but date <= to.
  const [inflowBefore, outflowBefore, inflowAfter, outflowAfter] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["income", "transfer", "saving", "reimbursement"] }, toAccountId: { $ne: null }, date: { $lt: from } } },
      { $group: { _id: "$toAccountId", amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["expense", "transfer", "saving"] }, fromAccountId: { $ne: null }, date: { $lt: from } } },
      { $group: { _id: "$fromAccountId", amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["income", "transfer", "saving", "reimbursement"] }, toAccountId: { $ne: null }, date: { $lte: to } } },
      { $group: { _id: "$toAccountId", amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["expense", "transfer", "saving"] }, fromAccountId: { $ne: null }, date: { $lte: to } } },
      { $group: { _id: "$fromAccountId", amount: { $sum: "$amount" } } },
    ]),
  ]);

  const inBeforeMap = new Map(inflowBefore.map((r) => [r._id.toString(), r.amount ?? 0]));
  const outBeforeMap = new Map(outflowBefore.map((r) => [r._id.toString(), r.amount ?? 0]));

  const inAfterMap = new Map(inflowAfter.map((r) => [r._id.toString(), r.amount ?? 0]));
  const outAfterMap = new Map(outflowAfter.map((r) => [r._id.toString(), r.amount ?? 0]));

  const catMap = new Map(categories.map((c) => [c.id, c.toJSON()]));
  const byCategory = (spending?.byCategory ?? [])
    .map((row: { _id?: { toString(): string }; amount?: number }) => {
      const catIdStr = row._id?.toString();
      const cat = catIdStr ? catMap.get(catIdStr) : undefined;
      return {
        categoryId: catIdStr,
        name: cat?.name ?? "Uncategorized",
        icon: cat?.icon ?? "tag",
        color: cat?.color ?? "#94a3b8",
        amount: row.amount ?? 0,
      };
    })
    .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount);

  const netWorth = accounts.filter((a) => !a.archived).reduce((sum, a) => sum + a.balance, 0);
  // Opening balance includes ALL accounts (even now-archived ones) because
  // the money was there at the start of the period. Closing uses actual netWorth.
  const openingBalance = accounts
    .reduce((sum, a) => sum + a.openingBalance + (inBeforeMap.get(a.id) ?? 0) - (outBeforeMap.get(a.id) ?? 0), 0);
  
  const closingBalance = accounts
    .reduce((sum, a) => sum + a.openingBalance + (inAfterMap.get(a.id) ?? 0) - (outAfterMap.get(a.id) ?? 0), 0);

  res.json({
    range: { from, to },
    netWorth,
    income: incomeAgg[0]?.amount ?? 0,
    expense: spending?.expense[0]?.amount ?? 0,
    todayExpense: spending?.todayExpense[0]?.amount ?? 0,
    investment: spending?.investment[0]?.amount ?? 0,
    openingBalance,
    closingBalance,
    byCategory,
    accounts,
  });
});
