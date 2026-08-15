import type { NextFunction, Request, Response } from "express";
import { clerkClient } from "../services/clerk";

// Must run after requireClerkAuth (needs req.userId). Admin-ness lives in
// Clerk's privateMetadata rather than app_users — it's a property of the
// account, not the approval workflow, and privateMetadata is never readable
// from the frontend SDK, only from here.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await clerkClient.users.getUser(req.userId as string);

  if (user.privateMetadata?.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}
