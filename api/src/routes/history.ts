import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { listAllIdentifications, deleteIdentifications } from "../services/identifications";

export const historyRouter = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

function parseIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { ids?: unknown }).ids)) return null;
  const ids = (body as { ids: unknown[] }).ids;
  if (!ids.every((id) => typeof id === "string") || ids.length === 0) return null;
  return ids as string[];
}

historyRouter.get("/admin/identifications", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    const requestedOffset = Number(req.query.offset);
    const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;

    const identifications = await listAllIdentifications(limit, offset);
    res.json(identifications);
  } catch (error) {
    next(error);
  }
});

historyRouter.post("/admin/identifications/delete", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const ids = parseIds(req.body);
    if (!ids) {
      res.status(400).json({ error: "ids must be a non-empty array of strings." });
      return;
    }

    await deleteIdentifications(ids);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
