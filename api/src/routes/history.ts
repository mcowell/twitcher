import { Router } from "express";
import { requireClerkAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import {
  listAllIdentifications,
  deleteIdentifications,
  getAnyIdentificationById,
  setAnyIdentificationPublic,
} from "../services/identifications";

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

historyRouter.get("/admin/identifications/:id", requireClerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const identification = await getAnyIdentificationById(req.params.id as string);
    if (!identification) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json(identification);
  } catch (error) {
    next(error);
  }
});

historyRouter.patch(
  "/admin/identifications/:id/share",
  requireClerkAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { isPublic } = req.body;
      if (typeof isPublic !== "boolean") {
        res.status(400).json({ error: "isPublic must be a boolean." });
        return;
      }

      const updated = await setAnyIdentificationPublic(req.params.id as string, isPublic);
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
