import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { config } from "../config";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Buffers of different lengths would throw in timingSafeEqual — lengths
  // differing is itself not secret, so it's fine to branch on that alone.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// A static shared secret, not a Clerk JWT — this route is called by a
// script on the home network, not a signed-in human, so there's no session
// to verify. Scoped to only the /ingest/* routes, so a leak doesn't expose
// anything else (approval, admin, etc.).
export function requireIngestSecret(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;

  if (!token || !safeEqual(token, config.frigateIngestSecret)) {
    res.status(401).json({ error: "Invalid or missing ingest secret." });
    return;
  }

  next();
}
