import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { listRecentIdentifications } from "../services/identifications";

export const identificationsRouter = Router();

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 20;

identificationsRouter.get("/identifications", requireClerkAuth, requireApproval, async (req, res, next) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const identifications = await listRecentIdentifications(req.userId as string, limit);
    res.json(identifications);
  } catch (error) {
    next(error);
  }
});
