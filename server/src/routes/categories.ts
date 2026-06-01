import { Router } from "express";
import { Category, Transaction } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { categorySchema, categoryUpdateSchema } from "../lib/validate";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req: AuthedRequest, res) => {
  const categories = await Category.find({ userId: req.userId }).sort({ kind: 1, name: 1 });
  res.json(categories);
});

categoriesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const category = await Category.create({ ...parsed.data, userId: req.userId });
  res.status(201).json(category);
});

categoriesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const owned = await Category.findOne({ _id: req.params.id, userId: req.userId });
  if (!owned) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const category = await Category.findByIdAndUpdate(req.params.id, parsed.data, { new: true });
  res.json(category);
});

categoriesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await Category.findOne({ _id: req.params.id, userId: req.userId });
  if (!owned) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  // Transactions keep their record; categoryId is set to null via the schema relation in Prisma. We must do it manually here.
  await Transaction.updateMany({ categoryId: req.params.id }, { $set: { categoryId: null } });
  await Category.findByIdAndDelete(req.params.id);
  res.status(204).end();
});
