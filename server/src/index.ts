import express from "express";
import cors from "cors";
import { env } from "./env";
import { authRouter } from "./auth/routes";
import { accountsRouter } from "./routes/accounts";
import { categoriesRouter } from "./routes/categories";
import { transactionsRouter } from "./routes/transactions";
import { summaryRouter } from "./routes/summary";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "fincheck" }));

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/summary", summaryRouter);

// Fallback error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[fincheck] unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[fincheck] API listening on http://localhost:${env.port}`);
});
