import { Router } from "express";
import { prisma } from "../db";
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
  const { openingBalance, ...rest } = parsed.data;
  const account = await prisma.account.create({
    data: { ...rest, openingBalance: toMinor(openingBalance), userId: req.userId! },
  });
  res.status(201).json({ ...account, balance: account.openingBalance });
});

accountsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = accountUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const owned = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const { openingBalance, ...rest } = parsed.data;
  await prisma.account.update({
    where: { id: req.params.id },
    data: { ...rest, ...(openingBalance !== undefined ? { openingBalance: toMinor(openingBalance) } : {}) },
  });
  res.json((await accountsWithBalances(req.userId!)).find((a) => a.id === req.params.id));
});

accountsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await prisma.account.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const txnCount = await prisma.transaction.count({
    where: { userId: req.userId!, OR: [{ fromAccountId: req.params.id }, { toAccountId: req.params.id }] },
  });
  if (txnCount > 0) {
    res.status(409).json({
      error: `This account has ${txnCount} transaction(s). Archive it instead, or delete its transactions first.`,
    });
    return;
  }
  await prisma.account.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
