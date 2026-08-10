import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import { config } from "../config";

// Augment Express's Request type so downstream handlers can read the
// authenticated Clerk user ID without re-parsing the token.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireClerkAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: config.clerkSecretKey,
      // Only accept tokens minted for our known frontend origin(s) — blocks
      // a token issued to some other Clerk-backed app from being replayed
      // against this API.
      authorizedParties: config.allowedOrigins,
    });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
