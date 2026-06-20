import mongoose, { Schema, Document } from "mongoose";
import { env } from "./env";

export async function connectDb() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.databaseUrl);
  console.log(`[fincheck] MongoDB connected`);
}

// Ensure virtuals (like id) are included in JSON and objects
const toJSON = {
  virtuals: true,
  transform: (doc: any, ret: any) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
};

// User Schema
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: "INR" },
    monthlyBudget: { type: Number, default: null }, // minor units
  },
  { timestamps: true, toJSON, toObject: toJSON, collection: "User" }
);
export const User = mongoose.models.User || mongoose.model("User", userSchema);

// Account Schema
const accountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    type: { type: String, default: "bank" },
    openingBalance: { type: Number, default: 0 }, // minor units
    color: { type: String, default: "#6366f1" },
    icon: { type: String, default: "bank" },
    archived: { type: Boolean, default: false },
    goalTarget: { type: Number, default: null }, // minor units
    order: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON, toObject: toJSON, collection: "Account" }
);
export const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);

// Category Schema
const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    kind: { type: String, required: true }, // income | expense
    color: { type: String, default: "#6366f1" },
    icon: { type: String, default: "tag" },
  },
  { timestamps: false, toJSON, toObject: toJSON, collection: "Category" } // Prisma schema didn't have createdAt for Category, but we can just use default schema
);
export const Category = mongoose.models.Category || mongoose.model("Category", categorySchema);

// Transaction Schema
const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true }, // income | expense | transfer
    amount: { type: Number, required: true }, // minor units, always positive
    date: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    fromAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    toAccountId: { type: Schema.Types.ObjectId, ref: "Account", default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: true, toJSON, toObject: toJSON, collection: "Transaction" }
);

transactionSchema.virtual("fromAccount", {
  ref: "Account",
  localField: "fromAccountId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("toAccount", {
  ref: "Account",
  localField: "toAccountId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("category", {
  ref: "Category",
  localField: "categoryId",
  foreignField: "_id",
  justOne: true,
});

export const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

// Split Schema
const splitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    totalAmount: { type: Number, required: true }, // minor units
    myShare: { type: Number, required: true }, // minor units
    splitNote: { type: String, default: "" },
    settled: { type: Boolean, default: false },
    settledAmount: { type: Number, default: 0 }, // minor units
  },
  { timestamps: true, toJSON, toObject: toJSON, collection: "Split" }
);

splitSchema.virtual("transaction", {
  ref: "Transaction",
  localField: "transactionId",
  foreignField: "_id",
  justOne: true,
});

export const Split = mongoose.models.Split || mongoose.model("Split", splitSchema);
