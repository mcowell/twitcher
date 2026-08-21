import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { listPublicIdentifications, getPublicIdentificationById } from "../services/identifications";

export const communityRouter = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Gated behind sign-in + approval for now, same as everything else — but
// deliberately kept separate from the rest of /identifications and never
// includes uploader identity (see PublicIdentification), specifically so
// this can become a public, unauthenticated route later just by dropping
// the two middlewares below, with no further privacy work needed.
communityRouter.get("/community", requireClerkAuth, requireApproval, async (req, res, next) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const requestedOffset = Number(req.query.offset);
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    const identifications = await listPublicIdentifications(limit, offset);
    res.json(identifications);
  } catch (error) {
    next(error);
  }
});

communityRouter.get("/community/:id", requireClerkAuth, requireApproval, async (req, res, next) => {
  try {
    const identification = await getPublicIdentificationById(req.params.id as string);
    if (!identification) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json(identification);
  } catch (error) {
    next(error);
  }
});
