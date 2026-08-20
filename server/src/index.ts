import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./env";
import { connectDb } from "./db";
import { authRouter } from "./auth/routes";
import { accountsRouter } from "./routes/accounts";
import { categoriesRouter } from "./routes/categories";
import { transactionsRouter } from "./routes/transactions";
import { summaryRouter } from "./routes/summary";
import { splitsRouter } from "./routes/splits";

const app = express();

// Render/Vercel terminate TLS at a proxy in front of the app.
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false, // Don't break React app inline styles/scripts if not configured
}));

// CORS: open by default (token auth, no cookies). Restrict by setting
// CLIENT_ORIGIN to a comma-separated list of allowed origins in production.
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : { origin: true }));

app.use(express.json({ limit: "100kb" }));

// Slow requests are the useful signal on a small instance. This stays quiet
// for normal traffic but makes slow endpoint/database paths visible in Render.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs >= 500) {
      console.warn(`[fincheck] slow request ${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(durationMs)}ms`);
    }
  });
  next();
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "fincheck" }));

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/splits", splitsRouter);

// Unknown API routes return JSON (not the SPA shell).
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// In production we serve the built React app from the same service, so the
// frontend and API share an origin (no CORS needed). This is a no-op in dev
// where Vite serves the client and proxies /api.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
   
  console.log(`[fincheck] serving client build from ${clientDist}`);
}

// Fallback error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
   
  console.error("[fincheck] unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

let server: ReturnType<typeof app.listen>;

connectDb().then(() => {
  server = app.listen(env.port, () => {
     
    console.log(`[fincheck] API listening on http://localhost:${env.port} [${env.nodeEnv}]`);
    console.log(`[fincheck] CORS origins: ${allowedOrigins.length ? allowedOrigins.join(", ") : "(any — CLIENT_ORIGIN not set)"}`);
  });
});

process.on("SIGTERM", () => {
  console.log("[fincheck] SIGTERM received, shutting down gracefully");
  if (server) {
    server.close(() => {
      mongoose.connection.close(false).then(() => {
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});

process.on("SIGINT", () => {
  console.log("[fincheck] SIGINT received, shutting down gracefully");
  if (server) {
    server.close(() => {
      mongoose.connection.close(false).then(() => {
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
});
