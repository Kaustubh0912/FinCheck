import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User } from "../db";
import { loginSchema, registerSchema, changePasswordSchema, profileUpdateSchema, toMinor } from "../lib/validate";
import { seedUserDefaults } from "../lib/seed";
import { requireAuth, signToken, type AuthedRequest } from "./middleware";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function publicUser(u: { id: string; email: string; name: string; currency: string; monthlyBudget?: number | null }) {
  return { id: u.id, email: u.email, name: u.name, currency: u.currency, monthlyBudget: u.monthlyBudget };
}

authRouter.post("/register", authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const { email, name, password, currency } = parsed.data;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase(), name, passwordHash, currency: currency ?? "INR", tokenVersion: 0 });
    await seedUserDefaults(user.id);
    res.status(201).json({ token: signToken(user.id, 0), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const { email, password } = parsed.data;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    res.json({ token: signToken(user.id, user.tokenVersion ?? 0), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const { name, currency, monthlyBudget } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) updateData.name = name.trim();
    if (typeof currency === "string" && currency.length === 3) updateData.currency = currency;
    if (monthlyBudget !== undefined) {
      updateData.monthlyBudget = monthlyBudget !== null ? toMinor(monthlyBudget) : null;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      updateData,
      { returnDocument: "after" }
    );
    res.json({ user: publicUser(user as Parameters<typeof publicUser>[0]) });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me/password", requireAuth, async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const newTokenVersion = (user.tokenVersion ?? 0) + 1;
    await User.findByIdAndUpdate(req.userId, { passwordHash, tokenVersion: newTokenVersion });
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});
