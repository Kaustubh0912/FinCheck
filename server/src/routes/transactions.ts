import { Router } from "express";
import mongoose from "mongoose";
import { Transaction, Account, Category, Split } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { transactionSchema, transactionUpdateSchema, toMinor } from "../lib/validate";
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
    const { from, to, accountId, type, categoryId, q, amountMin, amountMax, limit, skip } = req.query as Record<string, string>;
    const where: Record<string, any> = { userId: req.userId };
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
    if (q && typeof q === "string" && q.trim()) {
      const sanitized = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      where.note = { $regex: sanitized, $options: "i" };
    }
    if (amountMin !== undefined || amountMax !== undefined) {
      where.amount = {};
      if (amountMin !== undefined && amountMin !== "" && !isNaN(Number(amountMin))) {
        where.amount.$gte = Number(amountMin);
      }
      if (amountMax !== undefined && amountMax !== "" && !isNaN(Number(amountMax))) {
        where.amount.$lte = Number(amountMax);
      }
      if (Object.keys(where.amount).length === 0) {
        delete where.amount;
      }
    }
    if (from || to) {
      where.date = {};
      if (from) {
        if (isNaN(Date.parse(from))) return res.status(400).json({ error: "Invalid from date" });
        where.date.$gte = new Date(from);
      }
      if (to) {
        if (isNaN(Date.parse(to))) return res.status(400).json({ error: "Invalid to date" });
        where.date.$lte = new Date(to);
      }
    }
    const take = limit ? Math.min(Number(limit), 1000) : 1000;
    const skipCount = skip ? Number(skip) : 0;
    const transactions = await Transaction.find(where)
      .sort({ date: -1, createdAt: -1 })
      .skip(skipCount)
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
    let transaction: mongoose.Document | null = null;

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
          excludeFromBudget: d.excludeFromBudget ?? false,
        }], { session });
        
        transaction = created[0];
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(transaction!._id)
      .populate("fromAccount", "id name icon color")
      .populate("toAccount", "id name icon color")
      .populate("category", "id name icon color kind");

    res.status(201).json(populated);
  } catch (err: unknown) {
    if ((err as Error).message?.startsWith("400:")) {
      res.status(400).json({ error: (err as Error).message.substring(4) });
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

    const parsed = transactionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const d = parsed.data;

    const session = await mongoose.startSession();
    let transaction: mongoose.Document | null = null;

    try {
      await session.withTransaction(async () => {
        const owned = await Transaction.findOne({ _id: req.params.id, userId: req.userId }).session(session);
        if (!owned) {
          throw new Error("404:Transaction not found");
        }

        const newType = d.type ?? owned.type;
        const newAmount = d.amount !== undefined ? toMinor(d.amount) : owned.amount;
        
        const requiresFrom = ["expense", "transfer", "saving"].includes(newType);
        const requiresTo = ["income", "transfer", "saving", "reimbursement"].includes(newType);

        let fromAccountId = owned.fromAccountId;
        if (d.fromAccountId !== undefined) {
          fromAccountId = requiresFrom ? (d.fromAccountId ?? null) : null;
        } else if (!requiresFrom) {
          fromAccountId = null;
        }

        let toAccountId = owned.toAccountId;
        if (d.toAccountId !== undefined) {
          toAccountId = requiresTo ? (d.toAccountId ?? null) : null;
        } else if (!requiresTo) {
          toAccountId = null;
        }

        let categoryId = owned.categoryId;
        if (d.categoryId !== undefined) {
          categoryId = ["income", "expense"].includes(newType) ? (d.categoryId ?? null) : null;
        } else if (!["income", "expense"].includes(newType)) {
          categoryId = null;
        }

        const ownErr = await assertOwnership(req.userId!, { fromAccountId, toAccountId, categoryId }, session);
        if (ownErr) {
          throw new Error(`400:${ownErr}`);
        }

        if (requiresFrom && fromAccountId) {
          const ok = await hasSufficientBalance(fromAccountId, newAmount, session, req.params.id);
          if (!ok) {
            throw new Error(`400:Insufficient balance in source account`);
          }
        }

        owned.type = newType;
        owned.amount = newAmount;
        if (d.date !== undefined) owned.date = d.date;
        if (d.note !== undefined) owned.note = d.note ?? "";
        owned.fromAccountId = fromAccountId;
        owned.toAccountId = toAccountId;
        owned.categoryId = categoryId;
        if (d.excludeFromBudget !== undefined) owned.excludeFromBudget = d.excludeFromBudget ?? false;

        await owned.save({ session });
        transaction = owned;
      });
    } finally {
      await session.endSession();
    }

    const populated = await Transaction.findById(transaction!._id)
      .populate("fromAccount", "id name icon color")
      .populate("toAccount", "id name icon color")
      .populate("category", "id name icon color kind");

    res.json(populated);
  } catch (err: unknown) {
    if ((err as Error).message?.startsWith("400:")) {
      res.status(400).json({ error: (err as Error).message.substring(4) });
    } else if ((err as Error).message?.startsWith("404:")) {
      res.status(404).json({ error: (err as Error).message.substring(4) });
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
  } catch (err: unknown) {
    if ((err as Error).message?.startsWith("404:")) {
      res.status(404).json({ error: (err as Error).message.substring(4) });
    } else {
      next(err);
    }
  }
});
