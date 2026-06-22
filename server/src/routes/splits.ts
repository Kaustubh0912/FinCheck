import { Router } from "express";
import mongoose from "mongoose";
import { Split, Transaction, Account, Category } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { createSplitSchema, repaySplitSchema, toMinor } from "../lib/validate";
import { hasSufficientBalance } from "../lib/balances";

export const splitsRouter = Router();
splitsRouter.use(requireAuth);

splitsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const query: Record<string, unknown> = { userId: req.userId };
    if (req.query.settled === "true") query.settled = true;
    if (req.query.settled === "false") query.settled = false;
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(String(req.query.from));
      if (req.query.to) query.createdAt.$lte = new Date(String(req.query.to));
    }

    const limit = req.query.limit ? Math.min(Number(req.query.limit), 1000) : 1000;
    const skip = req.query.skip ? Number(req.query.skip) : 0;

    const splits = await Split.find(query)
      .populate("transaction")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json(splits);
  } catch (err) {
    next(err);
  }
});

splitsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSplitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const { totalAmount, myShare, fromAccountId, categoryId, note, date, excludeFromBudget } = parsed.data;

    if (myShare > totalAmount) {
      return res.status(400).json({ error: "My share cannot be greater than the total amount." });
    }

    const session = await mongoose.startSession();
    let split: mongoose.Document | null = null;

    try {
      await session.withTransaction(async () => {
        // Ownership checks
        if (fromAccountId && !mongoose.Types.ObjectId.isValid(fromAccountId)) {
          throw new Error("400:Invalid fromAccountId.");
        }
        if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
          throw new Error("400:Invalid categoryId.");
        }

        const acc = await Account.findOne({ _id: fromAccountId, userId: req.userId }).session(session);
        if (!acc) throw new Error("400:Unknown account.");

        if (categoryId) {
          const cat = await Category.findOne({ _id: categoryId, userId: req.userId }).session(session);
          if (!cat) throw new Error("400:Unknown category.");
        }

        // Sufficient balance check
        const ok = await hasSufficientBalance(fromAccountId, toMinor(myShare), session);
        if (!ok) throw new Error("400:Insufficient balance in source account");

        // Create the underlying expense transaction for "myShare"
        const txnArr = await Transaction.create([{
          userId: req.userId,
          type: "expense",
          amount: toMinor(myShare),
          fromAccountId,
          categoryId: categoryId || null,
          note: note || "",
          date: date || new Date(),
          excludeFromBudget: excludeFromBudget ?? false,
        }], { session });
        const txn = txnArr[0];

        // Create the split record
        const splitArr = await Split.create([{
          userId: req.userId,
          transactionId: txn._id,
          totalAmount: toMinor(totalAmount),
          myShare: toMinor(myShare),
          splitNote: note || "",
          settled: totalAmount === myShare,
          settledAmount: 0,
        }], { session });
        split = splitArr[0];
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json(split);
  } catch (err: unknown) {
    if ((err as Error).message?.startsWith("400:")) {
      res.status(400).json({ error: (err as Error).message.substring(4) });
    } else {
      next(err);
    }
  }
});

splitsRouter.post("/:id/repay", async (req: AuthedRequest, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid split ID" });
    }

    const parsed = repaySplitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const { amount, toAccountId } = parsed.data;
    const minorAmount = toMinor(amount);

    const session = await mongoose.startSession();
    let splitResult: mongoose.Document | null = null;

    try {
      await session.withTransaction(async () => {
        const split = await Split.findOne({ _id: req.params.id, userId: req.userId }).session(session);
        if (!split) throw new Error("404:Split not found");

        if (!mongoose.Types.ObjectId.isValid(toAccountId)) {
          throw new Error("400:Invalid toAccountId");
        }

        const account = await Account.findOne({ _id: toAccountId, userId: req.userId }).session(session);
        if (!account) throw new Error("400:Account not found.");

        const targetToSettle = split.totalAmount - split.myShare;
        const remainingOwed = targetToSettle - split.settledAmount;
        
        if (remainingOwed <= 0) {
          throw new Error("400:This split is already fully settled.");
        }

        const cappedAmount = Math.min(minorAmount, remainingOwed);

        // Create reimbursement transaction
        await Transaction.create([{
          userId: req.userId,
          type: "reimbursement",
          amount: cappedAmount,
          toAccountId,
          note: `Repayment for: ${split.splitNote || "Split"}`,
          date: new Date(),
        }], { session });

        // Update split
        const newSettledAmount = split.settledAmount + cappedAmount;
        
        split.settledAmount = newSettledAmount;
        if (newSettledAmount >= targetToSettle) {
          split.settled = true;
        }
        await split.save({ session });
        splitResult = split;
      });
    } finally {
      await session.endSession();
    }

    res.json(splitResult);
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
