import { Router } from "express";
import { Transaction, Account, Category, Split } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { transactionSchema, toMinor } from "../lib/validate";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

/** Verify that every referenced account/category belongs to the requesting user. */
async function assertOwnership(
  userId: string,
  ids: { fromAccountId?: string | null; toAccountId?: string | null; categoryId?: string | null }
): Promise<string | null> {
  const accountIds = [ids.fromAccountId, ids.toAccountId].filter(Boolean) as string[];
  if (accountIds.length) {
    const count = await Account.countDocuments({ userId, _id: { $in: accountIds } });
    if (count !== new Set(accountIds).size) return "Unknown account.";
  }
  if (ids.categoryId) {
    const cat = await Category.findOne({ userId, _id: ids.categoryId });
    if (!cat) return "Unknown category.";
  }
  return null;
}

transactionsRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to, accountId, type, categoryId, limit } = req.query as Record<string, string>;
  const where: any = { userId: req.userId };
  if (type && ["income", "expense", "transfer"].includes(type)) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.$or = [{ fromAccountId: accountId }, { toAccountId: accountId }];
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
});

transactionsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const d = parsed.data;
  const ownErr = await assertOwnership(req.userId!, d);
  if (ownErr) {
    res.status(400).json({ error: ownErr });
    return;
  }
  
  const fromAccountId = d.type === "income" ? null : d.fromAccountId ?? null;
  const toAccountId = d.type === "expense" ? null : d.toAccountId ?? null;
  const categoryId = d.type === "transfer" ? null : d.categoryId ?? null;

  const transaction = await Transaction.create({
    userId: req.userId,
    type: d.type,
    amount: toMinor(d.amount),
    date: d.date ?? new Date(),
    note: d.note ?? "",
    fromAccountId,
    toAccountId,
    categoryId,
  });

  const populated = await Transaction.findById(transaction._id)
    .populate("fromAccount", "id name icon color")
    .populate("toAccount", "id name icon color")
    .populate("category", "id name icon color kind");

  res.status(201).json(populated);
});

transactionsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const owned = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!owned) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  const parsed = transactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const d = parsed.data;
  const ownErr = await assertOwnership(req.userId!, d);
  if (ownErr) {
    res.status(400).json({ error: ownErr });
    return;
  }
  
  const fromAccountId = d.type === "income" ? null : d.fromAccountId ?? null;
  const toAccountId = d.type === "expense" ? null : d.toAccountId ?? null;
  const categoryId = d.type === "transfer" ? null : d.categoryId ?? null;

  const transaction = await Transaction.findByIdAndUpdate(
    req.params.id,
    {
      type: d.type,
      amount: toMinor(d.amount),
      date: d.date ?? owned.date,
      note: d.note ?? "",
      fromAccountId,
      toAccountId,
      categoryId,
    },
    { returnDocument: "after" }
  )
    .populate("fromAccount", "id name icon color")
    .populate("toAccount", "id name icon color")
    .populate("category", "id name icon color kind");

  res.json(transaction);
});

transactionsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
  if (!owned) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  await Split.deleteMany({ transactionId: req.params.id });
  await Transaction.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
