import express from "express";
import { authRouter } from "../auth/routes";
import { accountsRouter } from "../routes/accounts";
import { categoriesRouter } from "../routes/categories";
import { transactionsRouter } from "../routes/transactions";
import { summaryRouter } from "../routes/summary";
import { splitsRouter } from "../routes/splits";

// This file exports the app for testing purposes, without the port binding or DB connection logic
const testApp = express();

testApp.use(express.json());

testApp.use("/api/auth", authRouter);
testApp.use("/api/accounts", accountsRouter);
testApp.use("/api/categories", categoriesRouter);
testApp.use("/api/transactions", transactionsRouter);
testApp.use("/api/summary", summaryRouter);
testApp.use("/api/splits", splitsRouter);

// Fallback error handler
testApp.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("TEST APP ERROR:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

export { testApp };
