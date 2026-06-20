import { Router } from "express";
import { Split, Transaction } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { createSplitSchema, repaySplitSchema, toMinor } from "../lib/validate";

export const splitsRouter = Router();
splitsRouter.use(requireAuth);

splitsRouter.get("/", async (req: AuthedRequest, res) => {
  const query: any = { userId: req.userId };
  if (req.query.settled === "true") query.settled = true;
  if (req.query.settled === "false") query.settled = false;

  const splits = await Split.find(query)
    .populate("transaction")
    .sort({ createdAt: -1 });
  
  res.json(splits);
});

splitsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSplitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { totalAmount, myShare, fromAccountId, categoryId, note, date } = parsed.data;

  if (myShare > totalAmount) {
    res.status(400).json({ error: "My share cannot be greater than the total amount." });
    return;
  }

  // Create the underlying expense transaction for "myShare"
  const txn = await Transaction.create({
    userId: req.userId,
    type: "expense",
    amount: toMinor(myShare),
    fromAccountId,
    categoryId: categoryId || null,
    note: note || "",
    date: date || new Date(),
  });

  // Create the split record
  const split = await Split.create({
    userId: req.userId,
    transactionId: txn._id,
    totalAmount: toMinor(totalAmount),
    myShare: toMinor(myShare),
    splitNote: note || "",
    settled: totalAmount === myShare,
    settledAmount: 0,
  });

  res.status(201).json(split);
});

splitsRouter.post("/:id/repay", async (req: AuthedRequest, res) => {
  const parsed = repaySplitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const split = await Split.findOne({ _id: req.params.id, userId: req.userId });
  if (!split) {
    res.status(404).json({ error: "Split not found" });
    return;
  }

  const { amount, toAccountId } = parsed.data;
  const minorAmount = toMinor(amount);

  // Create reimbursement transaction
  await Transaction.create({
    userId: req.userId,
    type: "reimbursement",
    amount: minorAmount,
    toAccountId,
    note: `Repayment for: ${split.splitNote || "Split"}`,
    date: new Date(),
  });

  // Update split
  const newSettledAmount = split.settledAmount + minorAmount;
  const targetToSettle = split.totalAmount - split.myShare;
  
  split.settledAmount = newSettledAmount;
  if (newSettledAmount >= targetToSettle) {
    split.settled = true;
  }
  await split.save();

  res.json(split);
});
