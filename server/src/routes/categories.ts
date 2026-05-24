import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, type AuthedRequest } from "../auth/middleware";
import { categorySchema, categoryUpdateSchema } from "../lib/validate";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

categoriesRouter.get("/", async (req: AuthedRequest, res) => {
  const categories = await prisma.category.findMany({
    where: { userId: req.userId! },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  res.json(categories);
});

categoriesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const category = await prisma.category.create({ data: { ...parsed.data, userId: req.userId! } });
  res.status(201).json(category);
});

categoriesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const owned = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const category = await prisma.category.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(category);
});

categoriesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const owned = await prisma.category.findFirst({ where: { id: req.params.id, userId: req.userId! } });
  if (!owned) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  // Transactions keep their record; categoryId is set to null via the schema relation.
  await prisma.category.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
