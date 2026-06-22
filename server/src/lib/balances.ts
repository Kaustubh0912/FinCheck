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

export async function hasSufficientBalance(
  accountId: string,
  amount: number,
  session: mongoose.ClientSession,
  excludeTransactionId?: string
): Promise<boolean> {
  const accountObjectId = new mongoose.Types.ObjectId(accountId);

  const inflowMatch: Record<string, any> = { toAccountId: accountObjectId, type: { $in: ["income", "transfer", "saving", "reimbursement"] } };
  const outflowMatch: Record<string, any> = { fromAccountId: accountObjectId, type: { $in: ["expense", "transfer", "saving"] } };

  if (excludeTransactionId) {
    const excludeId = new mongoose.Types.ObjectId(excludeTransactionId);
    inflowMatch._id = { $ne: excludeId };
    outflowMatch._id = { $ne: excludeId };
  }

  const [account, inflowResult, outflowResult] = await Promise.all([
    Account.findById(accountObjectId).session(session),
    Transaction.aggregate([
      { $match: inflowMatch },
      { $group: { _id: null, amount: { $sum: "$amount" } } }
    ]).session(session),
    Transaction.aggregate([
      { $match: outflowMatch },
      { $group: { _id: null, amount: { $sum: "$amount" } } }
    ]).session(session),
  ]);

  if (!account) return false;

  const inflow = inflowResult[0]?.amount ?? 0;
  const outflow = outflowResult[0]?.amount ?? 0;

  const currentBalance = account.openingBalance + inflow - outflow;
  return (currentBalance - amount) >= 0;
}

/** Compute live balances for all of a user's accounts. */
export async function accountsWithBalances(userId: string): Promise<AccountWithBalance[]> {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [accounts, inflow, outflow] = await Promise.all([
    Account.find({ userId }).sort({ order: 1, createdAt: 1 }),
    Transaction.aggregate([
      { $match: { userId: userObjectId, type: { $in: ["income", "transfer", "saving", "reimbursement"] }, toAccountId: { $ne: null } } },
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
