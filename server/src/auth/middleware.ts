import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { User } from "../db";

export interface AuthedRequest extends Request {
  userId?: string;
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
    const user = await User.findById(payload.sub).select("tokenVersion");
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
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
