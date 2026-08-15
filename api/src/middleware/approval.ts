import type { NextFunction, Request, Response } from "express";
import { getOrCreateAppUser } from "../services/appUsers";

// Must run after requireClerkAuth (needs req.userId). Blocks anything that
// isn't "approved" — pending and rejected users get the same 403, so a
// rejected user can't distinguish their status from someone still waiting.
export async function requireApproval(req: Request, res: Response, next: NextFunction) {
  const appUser = await getOrCreateAppUser(req.userId as string);

  if (appUser.status !== "approved") {
    res.status(403).json({ error: "Your account has not been approved yet." });
    return;
  }

  next();
}
