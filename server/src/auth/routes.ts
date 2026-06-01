import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../db";
import { loginSchema, registerSchema, changePasswordSchema } from "../lib/validate";
import { seedUserDefaults } from "../lib/seed";
import { requireAuth, signToken, type AuthedRequest } from "./middleware";

export const authRouter = Router();

function publicUser(u: { id: string; email: string; name: string; currency: string }) {
  return { id: u.id, email: u.email, name: u.name, currency: u.currency };
}

authRouter.post("/register", async (req, res) => {
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
  const user = await User.create({ email: email.toLowerCase(), name, passwordHash, currency: currency ?? "INR" });
  await seedUserDefaults(user.id);
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
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
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

authRouter.patch("/me", requireAuth, async (req: AuthedRequest, res) => {
  const { name, currency } = req.body ?? {};
  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof currency === "string" && currency.length === 3 ? { currency } : {}),
    },
    { new: true }
  );
  res.json({ user: publicUser(user as any) });
});

authRouter.patch("/me/password", requireAuth, async (req: AuthedRequest, res) => {
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
  await User.findByIdAndUpdate(req.userId, { passwordHash });
  res.json({ message: "Password updated successfully" });
});
