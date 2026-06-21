import { Router } from "express";
import mongoose from "mongoose";
import { Transaction, Account, Category, Split } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { transactionSchema, toMinor } from "../lib/validate";
import { hasSufficientBalance } from "../lib/balances";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

/** Verify that every referenced account/category belongs to the requesting user. */
async function assertOwnership(
  userId: string,
  ids: { fromAccountId?: string | null; toAccountId?: string | null; categoryId?: string | null },
  session?: mongoose.ClientSession
): Promise<string | null> {
  const accountIds = [ids.fromAccountId, ids.toAccountId].filter(Boolean) as string[];
  if (accountIds.length) {
    const count = await Account.countDocuments({ userId, _id: { $in: accountIds } }).session(session || null);
    if (count !== new Set(accountIds).size) return "Unknown account.";
  }
  if (ids.categoryId) {
    const cat = await Category.findOne({ userId, _id: ids.categoryId }).session(session || null);
    if (!cat) return "Unknown category.";
  }
  return null;
}

transactionsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { from, to, accountId, type, categoryId, limit } = req.query as Record<string, string>;
    const where: any = { userId: req.userId };
    if (type && ["income", "expense", "transfer", "saving", "reimbursement"].includes(type)) where.type = type;
    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
      where.categoryId = categoryId;
    }
    if (accountId) {
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }
      where.$or = [{ fromAccountId: accountId }, { toAccountId: accountId }];
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.$gte = new Date(from);
      if (to) where.date.$lte = new Date(to);
    }
    const take = limit ? Math.min(Number(limit), 500) : 500; // Provide a default limit for safety if we remove undefined
    const transactions = await Transaction.find(where)
      .sort({ date: -1, createdAt: -1 })
      .limit(take)
      .populate("fromAccount", "id name icon color")
      .populate("toAccount", "id name icon color")
      .populate("category", "id name icon color kind");
    
    res.json(transactions);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const d = parsed.data;

    const requiresFrom = ["expense", "transfer", "saving"].includes(d.type);
    const requiresTo = ["income", "transfer", "saving", "reimbursement"].includes(d.type);

    const fromAccountId = requiresFrom ? (d.fromAccountId ?? null) : null;
    const toAccountId = requiresTo ? (d.toAccountId ?? null) : null;
    const categoryId = ["income", "expense"].includes(d.type) ? (d.categoryId ?? null) : null;

    const session = await mongoose.startSession();
    let transaction: any = null;

    try {
      await session.withTransaction(async () => {
        const ownErr = await assertOwnership(req.userId!, d, session);
        if (ownErr) {
          throw new Error(`400:${ownErr}`);
        }
        
        if (requiresFrom && fromAccountId) {
          const ok = await hasSufficientBalance(fromAccountId, toMinor(d.amount), session);
          if (!ok) {
            throw new Error(`400:Insufficient balance in source account`);
          }
        }

        const created = await Transaction.create([{
          userId: req.userId,
          type: d.type,
          amount: toMinor(d.amount),
          date: d.date ?? new Date(),
          note: d.note ?? "",
          fromAccountId,
          toAccountId,
          categoryId,
        }], { session });
        
        transaction = created[0];
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(transaction._id)
      .populate("fromAccount", "id name icon color")
      .populate("toAccount", "id name icon color")
      .populate("category", "id name icon color kind");

    res.status(201).json(populated);
  } catch (err: any) {
    if (err.message?.startsWith("400:")) {
      res.status(400).json({ error: err.message.substring(4) });
    } else {
      next(err);
    }
  }
});

transactionsRouter.patch("/:id", async (req: AuthedRequest, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const d = parsed.data;

    const requiresFrom = ["expense", "transfer", "saving"].includes(d.type);
    const requiresTo = ["income", "transfer", "saving", "reimbursement"].includes(d.type);

    const fromAccountId = requiresFrom ? (d.fromAccountId ?? null) : null;
    const toAccountId = requiresTo ? (d.toAccountId ?? null) : null;
    const categoryId = ["income", "expense"].includes(d.type) ? (d.categoryId ?? null) : null;

    const session = await mongoose.startSession();
    let transaction: any = null;

    try {
      await session.withTransaction(async () => {
        const owned = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).session(session);
        if (!owned) {
          throw new Error("404:Transaction not found");
        }

        const ownErr = await assertOwnership(req.userId!, d, session);
        if (ownErr) {
          throw new Error(`400:${ownErr}`);
        }

        if (requiresFrom && fromAccountId) {
          const ok = await hasSufficientBalance(fromAccountId, toMinor(d.amount), session, req.params.id);
          if (!ok) {
            throw new Error(`400:Insufficient balance in source account`);
          }
        }

        owned.type = d.type;
        owned.amount = toMinor(d.amount);
        owned.date = d.date ?? owned.date;
        owned.note = d.note ?? "";
        owned.fromAccountId = fromAccountId;
        owned.toAccountId = toAccountId;
        owned.categoryId = categoryId;

        await owned.save({ session });
        transaction = owned;
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(transaction._id)
      .populate("fromAccount", "id name icon color")
      .populate("toAccount", "id name icon color")
      .populate("category", "id name icon color kind");

    res.json(populated);
  } catch (err: any) {
    if (err.message?.startsWith("400:")) {
      res.status(400).json({ error: err.message.substring(4) });
    } else if (err.message?.startsWith("404:")) {
      res.status(404).json({ error: err.message.substring(4) });
    } else {
      next(err);
    }
  }
});

transactionsRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const owned = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).session(session);
        if (!owned) {
          throw new Error("404:Transaction not found");
        }
        await Split.deleteMany({ transactionId: req.params.id }).session(session);
        await Transaction.findByIdAndDelete(req.params.id).session(session);
      });
    } finally {
      await session.endSession();
    }

    res.status(204).end();
  } catch (err: any) {
    if (err.message?.startsWith("404:")) {
      res.status(404).json({ error: err.message.substring(4) });
    } else {
      next(err);
    }
  }
});
