import { Router } from "express";
import { listPublicIdentifications, getPublicIdentificationById } from "../services/identifications";

export const communityRouter = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// Deliberately public, no auth at all — reachable by anyone, signed in or
// not. Kept in its own file, separate from the rest of /identifications,
// and PublicIdentification never includes uploader identity; sharing
// itself also copies the image to a user-id-free storage path (see
// applyPublicSharingChange in identifications.ts) specifically so this
// route being fully open doesn't leak anything beyond what the owner
// explicitly chose to share.
communityRouter.get("/community", async (req, res, next) => {
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

communityRouter.get("/community/:id", async (req, res, next) => {
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
