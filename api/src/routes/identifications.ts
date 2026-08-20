import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { listRecentIdentifications, getIdentificationById } from "../services/identifications";

export const identificationsRouter = Router();

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 100;

identificationsRouter.get("/identifications", requireClerkAuth, requireApproval, async (req, res, next) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const requestedOffset = Number(req.query.offset);
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    const identifications = await listRecentIdentifications(req.userId as string, limit, offset);
    res.json(identifications);
  } catch (error) {
    next(error);
  }
});

identificationsRouter.get("/identifications/:id", requireClerkAuth, requireApproval, async (req, res, next) => {
  try {
    const identification = await getIdentificationById(req.params.id as string, req.userId as string);
    if (!identification) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json(identification);
  } catch (error) {
    next(error);
  }
});
