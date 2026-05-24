// Frees the dev ports before `npm run dev` so a leftover server never causes
// EADDRINUSE. Runs automatically as the root `predev` script.
import { execSync } from "node:child_process";

const PORTS = [4000, 5173, 5174];
const isWin = process.platform === "win32";

function pidsOnPort(port) {
  const pids = new Set();
  try {
    if (isWin) {
      const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/.test(line)) continue;
        const cols = line.trim().split(/\s+/);
        if ((cols[1] || "").endsWith(":" + port)) pids.add(cols[cols.length - 1]);
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
      out.split(/\s+/).filter(Boolean).forEach((p) => pids.add(p));
    }
  } catch {
    /* nothing listening on this port */
  }
  return [...pids];
}

let freed = 0;
for (const port of PORTS) {
  for (const pid of pidsOnPort(port)) {
    if (!pid || pid === "0") continue;
    try {
      execSync(isWin ? `taskkill /PID ${pid} /F /T` : `kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`[predev] freed port ${port} (pid ${pid})`);
      freed++;
    } catch {
      /* already gone */
    }
  }
}
if (!freed) console.log("[predev] dev ports already free");
