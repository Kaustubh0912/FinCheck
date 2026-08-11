import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { User } from "../db";

export interface AuthedRequest extends Request {
  userId?: string;
}

const TOKEN_VERSION_CACHE_TTL_MS = 60_000;
const tokenVersionCache = new Map<string, { tokenVersion: number; expiresAt: number }>();

/** Remove a user's cached token version after a password/token change. */
export function invalidateTokenVersionCache(userId: string): void {
  tokenVersionCache.delete(userId);
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as { sub: string, tokenVersion?: number };
    const now = Date.now();
    const cached = tokenVersionCache.get(payload.sub);
    let tokenVersion: number;
    if (cached && cached.expiresAt > now) {
      tokenVersion = cached.tokenVersion;
    } else {
      const user = await User.findById(payload.sub).select("tokenVersion").lean();
      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }
      tokenVersion = user.tokenVersion ?? 0;
      tokenVersionCache.set(payload.sub, { tokenVersion, expiresAt: now + TOKEN_VERSION_CACHE_TTL_MS });
    }
    if ((payload.tokenVersion ?? 0) !== tokenVersion) {
      res.status(401).json({ error: "Token revoked" });
      return;
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(userId: string, tokenVersion: number = 0): string {
  return jwt.sign({ sub: userId, tokenVersion }, env.jwtSecret, { expiresIn: "30d", algorithm: "HS256" });
}
