import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { transactionSchema, toMinor } from "../lib/validate";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

const include = {
  fromAccount: { select: { id: true, name: true, icon: true, color: true } },
  toAccount: { select: { id: true, name: true, icon: true, color: true } },
  category: { select: { id: true, name: true, icon: true, color: true, kind: true } },
} satisfies Prisma.TransactionInclude;

/** Verify that every referenced account/category belongs to the requesting user. */
async function assertOwnership(
  userId: string,
  ids: { fromAccountId?: string | null; toAccountId?: string | null; categoryId?: string | null }
): Promise<string | null> {
  const accountIds = [ids.fromAccountId, ids.toAccountId].filter(Boolean) as string[];
  if (accountIds.length) {
    const count = await prisma.account.count({ where: { userId, id: { in: accountIds } } });
    if (count !== new Set(accountIds).size) return "Unknown account.";
  }
  if (ids.categoryId) {
    const cat = await prisma.category.findFirst({ where: { userId, id: ids.categoryId } });
    if (!cat) return "Unknown category.";
  }
  return null;
}

transactionsRouter.get("/", async (req: AuthedRequest, res) => {
  const { from, to, accountId, type, categoryId, limit } = req.query as Record<string, string>;
  const where: Prisma.TransactionWhereInput = { userId: req.userId! };
  if (type && ["income", "expense", "transfer"].includes(type)) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.OR = [{ fromAccountId: accountId }, { toAccountId: accountId }];
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  const transactions = await prisma.transaction.findMany({
    where,
    include,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit ? Math.min(Number(limit), 500) : undefined,
  });
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
  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId!,
      type: d.type,
      amount: toMinor(d.amount),
      date: d.date ?? new Date(),
      note: d.note ?? "",
      fromAccountId: d.type === "income" ? null : d.fromAccountId ?? null,
      toAccountId: d.type === "expense" ? null : d.toAccountId ?? null,
      categoryId: d.type === "transfer" ? null : d.categoryId ?? null,
    },
    include,
  });
  res.status(201).json(transaction);
});

transactionsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const owned = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId! } });
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
  const transaction = await prisma.transaction.update({
    where: { id: req.params.id },
    data: {
      type: d.type,
      amount: toMinor(d.amount),
      date: d.date ?? owned.date,
      note: d.note ?? "",
      fromAccountId: d.type === "income" ? null : d.fromAccountId ?? null,
      toAccountId: d.type === "expense" ? null : d.toAccountId ?? null,
      categoryId: d.type === "transfer" ? null : d.categoryId ?? null,
    },
    include,
  });
  res.json(transaction);
});

transactionsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await prisma.transaction.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  await prisma.transaction.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
