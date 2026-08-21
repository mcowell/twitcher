import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { listRecentIdentifications, getIdentificationById, setIdentificationPublic } from "../services/identifications";

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

identificationsRouter.patch(
  "/identifications/:id/share",
  requireClerkAuth,
  requireApproval,
  async (req, res, next) => {
    try {
      const { isPublic } = req.body;
      if (typeof isPublic !== "boolean") {
        res.status(400).json({ error: "isPublic must be a boolean." });
        return;
      }

      const updated = await setIdentificationPublic(req.params.id as string, req.userId as string, isPublic);
      if (!updated) {
        res.status(404).json({ error: "Not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);
