import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Account, Transaction } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { accountSchema, accountUpdateSchema, toMinor } from "../lib/validate";
import { accountsWithBalances } from "../lib/balances";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

accountsRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    res.json(await accountsWithBalances(req.userId!));
  } catch {
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

accountsRouter.post("/", async (req: AuthedRequest, res) => {
  try {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const { openingBalance, goalTarget, ...rest } = parsed.data;
    const account = await Account.create({
      ...rest,
      openingBalance: toMinor(openingBalance),
      goalTarget: goalTarget ? toMinor(goalTarget) : null,
      userId: req.userId,
    });
    // Mongoose doc spreading requires toJSON() or toObject()
    res.status(201).json({ ...account.toJSON(), balance: account.openingBalance });
  } catch {
    res.status(500).json({ error: "Failed to create account" });
  }
});

const reorderSchema = z.object({
  updates: z.array(z.object({
    id: z.string(),
    order: z.number()
  }))
});

accountsRouter.patch("/reorder", async (req: AuthedRequest, res) => {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    
    await Promise.all(
      parsed.data.updates.map((u) => {
        if (!mongoose.Types.ObjectId.isValid(u.id)) return Promise.resolve();
        return Account.findOneAndUpdate({ _id: u.id, userId: req.userId }, { order: u.order });
      })
    );
    
    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to reorder accounts" });
  }
});

accountsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }
    const parsed = accountUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const owned = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!owned) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const { openingBalance, goalTarget, ...rest } = parsed.data;
    await Account.findByIdAndUpdate(req.params.id, {
      ...rest,
      ...(openingBalance !== undefined ? { openingBalance: toMinor(openingBalance) } : {}),
      ...(goalTarget !== undefined ? { goalTarget: goalTarget ? toMinor(goalTarget) : null } : {}),
    });
    const balances = await accountsWithBalances(req.userId!);
    res.json(balances.find((a) => a.id === req.params.id));
  } catch {
    res.status(500).json({ error: "Failed to update account" });
  }
});

accountsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid account ID" });
      return;
    }
    const owned = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!owned) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const txnCount = await Transaction.countDocuments({
      userId: req.userId,
      $or: [{ fromAccountId: req.params.id }, { toAccountId: req.params.id }],
    });
    if (txnCount > 0) {
      res.status(409).json({
        error: `This account has ${txnCount} transaction(s). Archive it instead, or delete its transactions first.`,
      });
      return;
    }
    await Account.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});
