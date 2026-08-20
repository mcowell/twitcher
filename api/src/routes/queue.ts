import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { listStagedImages, deleteStagedImages, approveStagedImages } from "../services/stagedImages";

export const queueRouter = Router();

function parseIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { ids?: unknown }).ids)) return null;
  const ids = (body as { ids: unknown[] }).ids;
  if (!ids.every((id) => typeof id === "string") || ids.length === 0) return null;
  return ids as string[];
}

queueRouter.get("/admin/staged-images", requireClerkAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await listStagedImages());
  } catch (error) {
    next(error);
  }
});

queueRouter.post("/admin/staged-images/delete", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const ids = parseIds(req.body);
    if (!ids) {
      res.status(400).json({ error: "ids must be a non-empty array of strings." });
      return;
    }

    await deleteStagedImages(ids);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

queueRouter.post("/admin/staged-images/approve", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const ids = parseIds(req.body);
    if (!ids) {
      res.status(400).json({ error: "ids must be a non-empty array of strings." });
      return;
    }

    const results = await approveStagedImages(ids, req.userId as string);
    res.json(results);
  } catch (error) {
    next(error);
  }
});
