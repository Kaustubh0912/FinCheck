// Production launcher. Runs the API (which also serves the built web app) with
// NODE_ENV=production, cross-platform. Build first with `npm run build`.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("server/dist/index.js")) {
  console.error("[start] server/dist not found — run `npm run build` first.");
  process.exit(1);
}
if (!existsSync("client/dist/index.html")) {
  console.warn("[start] client/dist not found — the web app won't be served. Run `npm run build`.");
}

const child = spawn("npm run start -w server", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "production" },
});
child.on("exit", (code) => process.exit(code ?? 0));
