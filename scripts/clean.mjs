// Removes build artifacts so the next build is clean. Run: npm run clean
import { rmSync } from "node:fs";

const targets = [
  "server/dist",
  "client/dist",
  "client/tsconfig.tsbuildinfo",
  "client/node_modules/.vite",
];

for (const t of targets) {
  try {
    rmSync(t, { recursive: true, force: true });
    console.log("[clean] removed", t);
  } catch {
    /* ignore */
  }
}
console.log("[clean] done");
