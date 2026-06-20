import { Router } from "express";
import { Account, Transaction } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { accountSchema, accountUpdateSchema, toMinor } from "../lib/validate";
import { accountsWithBalances } from "../lib/balances";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

accountsRouter.get("/", async (req: AuthedRequest, res) => {
  res.json(await accountsWithBalances(req.userId!));
});

accountsRouter.post("/", async (req: AuthedRequest, res) => {
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
});

accountsRouter.patch("/reorder", async (req: AuthedRequest, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  
  await Promise.all(
    updates.map((u: { id: string, order: number }) => 
      Account.findOneAndUpdate({ _id: u.id, userId: req.userId }, { order: u.order })
    )
  );
  
  res.status(200).json({ success: true });
});

accountsRouter.patch("/:id", async (req: AuthedRequest, res) => {
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
});

accountsRouter.delete("/:id", async (req: AuthedRequest, res) => {
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
});
