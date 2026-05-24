import { prisma } from "../db";

/** Default categories + a starter Cash account created for every new user. */
const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; icon: string; color: string }[] = [
  { name: "Salary", kind: "income", icon: "briefcase", color: "#16a34a" },
  { name: "Business", kind: "income", icon: "building", color: "#0ea5e9" },
  { name: "Interest", kind: "income", icon: "invest", color: "#14b8a6" },
  { name: "Gifts", kind: "income", icon: "gift", color: "#ec4899" },
  { name: "Other Income", kind: "income", icon: "coins", color: "#64748b" },

  { name: "Food & Dining", kind: "expense", icon: "utensils", color: "#f97316" },
  { name: "Groceries", kind: "expense", icon: "cart", color: "#84cc16" },
  { name: "Transport", kind: "expense", icon: "car", color: "#3b82f6" },
  { name: "Shopping", kind: "expense", icon: "bag", color: "#a855f7" },
  { name: "Bills & Utilities", kind: "expense", icon: "bills", color: "#eab308" },
  { name: "Rent", kind: "expense", icon: "house", color: "#ef4444" },
  { name: "Health", kind: "expense", icon: "health", color: "#06b6d4" },
  { name: "Entertainment", kind: "expense", icon: "film", color: "#d946ef" },
  { name: "Education", kind: "expense", icon: "education", color: "#6366f1" },
  { name: "Other", kind: "expense", icon: "tag", color: "#64748b" },
];

export async function seedUserDefaults(userId: string): Promise<void> {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
  });
  await prisma.account.create({
    data: { userId, name: "Cash", type: "cash", icon: "cash", color: "#16a34a" },
  });
}
