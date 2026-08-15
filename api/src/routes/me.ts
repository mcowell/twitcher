import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { getOrCreateAppUser } from "../services/appUsers";

export const meRouter = Router();

// Intentionally not gated by requireApproval — this is the endpoint the
// frontend polls right after login to decide whether to show the pending
// state, so it has to work for pending users too.
meRouter.get("/me", requireClerkAuth, async (req, res, next) => {
  try {
    const appUser = await getOrCreateAppUser(req.userId as string);
    res.json({ status: appUser.status });
  } catch (error) {
    next(error);
  }
});
