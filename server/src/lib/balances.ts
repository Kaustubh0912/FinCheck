import mongoose from "mongoose";
import { Account, Transaction } from "../db";

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
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [accounts, inflow, outflow] = await Promise.all([
    Account.find({ userId }).sort({ createdAt: 1 }),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["income", "transfer", "saving"] }, toAccountId: { $ne: null } } },
      { $group: { _id: "$toAccountId", amount: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["expense", "transfer", "saving"] }, fromAccountId: { $ne: null } } },
      { $group: { _id: "$fromAccountId", amount: { $sum: "$amount" } } },
    ]),
  ]);

  const inMap = new Map(inflow.map((r) => [r._id.toString(), r.amount ?? 0]));
  const outMap = new Map(outflow.map((r) => [r._id.toString(), r.amount ?? 0]));

  return accounts.map((a) => {
    const doc = a.toJSON();
    return {
      ...doc,
      balance: doc.openingBalance + (inMap.get(doc.id) ?? 0) - (outMap.get(doc.id) ?? 0),
    };
  });
}
