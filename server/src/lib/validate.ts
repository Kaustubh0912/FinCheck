import { z } from "zod";

/** Convert a major-unit amount (e.g. rupees) to integer minor units (paise). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200).regex(/.*[0-9].*/, "Password must contain at least one number"),
  currency: z.string().length(3).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  currency: z.string().length(3).optional(),
  monthlyBudget: z.number().nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const accountTypes = ["bank", "cash", "card", "wallet", "investment", "savings", "other"] as const;

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(accountTypes).default("bank"),
  openingBalance: z.number().min(0).finite().default(0), // major units
  goalTarget: z.number().min(0).finite().nullable().default(null), // major units
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#6366f1"),
  icon: z.string().trim().max(24).default("bank"),
});

export const accountUpdateSchema = accountSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(["income", "expense"]),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").default("#6366f1"),
  icon: z.string().trim().max(24).default("tag"),
});

export const categoryUpdateSchema = categorySchema.partial();

const baseTxn = z.object({
  amount: z.number().positive().finite().max(99999999.99), // major units
  date: z.coerce.date().optional(),
  note: z.string().trim().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  fromAccountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
  excludeFromBudget: z.boolean().optional(),
});

export const transactionSchema = baseTxn
  .extend({ type: z.enum(["income", "expense", "transfer", "saving", "reimbursement"]) })
  .superRefine((val, ctx) => {
    if ((val.type === "income" || val.type === "reimbursement") && !val.toAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: `${val.type === "income" ? "Income" : "Reimbursement"} needs an account to credit.` });
    }
    if (val.type === "expense" && !val.fromAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromAccountId"], message: "Expense needs an account to debit." });
    }
    if (val.type === "transfer" || val.type === "saving") {
      if (!val.fromAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromAccountId"], message: "This transaction needs a source account." });
      if (!val.toAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: "This transaction needs a destination account." });
      if (val.fromAccountId && val.fromAccountId === val.toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: "Source and destination must differ." });
      }
    }
  });

export const transactionUpdateSchema = baseTxn
  .extend({ type: z.enum(["income", "expense", "transfer", "saving", "reimbursement"]) })
  .partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200).regex(/.*[0-9].*/, "Password must contain at least one number"),
});

export const createSplitSchema = z.object({
  totalAmount: z.number().positive().finite().max(99999999.99), // major units
  myShare: z.number().min(0).finite().max(99999999.99), // major units
  fromAccountId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  note: z.string().trim().max(200).optional(),
  date: z.coerce.date().optional(),
  excludeFromBudget: z.boolean().optional(),
});

export const repaySplitSchema = z.object({
  amount: z.number().positive().finite().max(99999999.99), // major units
  toAccountId: z.string().min(1),
});
