import { z } from "zod";

/** Convert a major-unit amount (e.g. rupees) to integer minor units (paise). */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(6).max(200),
  currency: z.string().length(3).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const accountTypes = ["bank", "cash", "card", "wallet", "investment", "other"] as const;

export const accountSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(accountTypes).default("bank"),
  openingBalance: z.number().finite().default(0), // major units
  color: z.string().max(20).default("#6366f1"),
  icon: z.string().max(24).default("bank"),
});

export const accountUpdateSchema = accountSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(40),
  kind: z.enum(["income", "expense"]),
  color: z.string().max(20).default("#6366f1"),
  icon: z.string().max(24).default("tag"),
});

export const categoryUpdateSchema = categorySchema.partial();

const baseTxn = z.object({
  amount: z.number().positive().finite(), // major units
  date: z.coerce.date().optional(),
  note: z.string().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  fromAccountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
});

export const transactionSchema = baseTxn
  .extend({ type: z.enum(["income", "expense", "transfer"]) })
  .superRefine((val, ctx) => {
    if (val.type === "income" && !val.toAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: "Income needs an account to credit." });
    }
    if (val.type === "expense" && !val.fromAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromAccountId"], message: "Expense needs an account to debit." });
    }
    if (val.type === "transfer") {
      if (!val.fromAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromAccountId"], message: "Transfer needs a source account." });
      if (!val.toAccountId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: "Transfer needs a destination account." });
      if (val.fromAccountId && val.fromAccountId === val.toAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toAccountId"], message: "Source and destination must differ." });
      }
    }
  });

export const transactionUpdateSchema = transactionSchema;
