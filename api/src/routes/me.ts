import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { getOrCreateAppUser } from "../services/appUsers";
import { clerkClient } from "../services/clerk";

export const meRouter = Router();

// Intentionally not gated by requireApproval — this is the endpoint the
// frontend polls right after login to decide whether to show the pending
// state, so it has to work for pending users too.
meRouter.get("/me", requireClerkAuth, async (req, res, next) => {
  try {
    const [appUser, clerkUser] = await Promise.all([
      getOrCreateAppUser(req.userId as string),
      clerkClient.users.getUser(req.userId as string),
    ]);
    res.json({
      status: appUser.status,
      isAdmin: clerkUser.privateMetadata?.role === "admin",
    });
  } catch (error) {
    next(error);
  }
});
