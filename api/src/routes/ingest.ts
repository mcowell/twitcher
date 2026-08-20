import { Router } from "express";
import { upload } from "../middleware/upload";
import { requireIngestSecret } from "../middleware/ingestAuth";
import { saveStagedImage } from "../services/stagedImages";
import type { Box } from "../services/imageCrop";

export const ingestRouter = Router();

// Sent as a JSON-encoded "[x1,y1,x2,y2]" form field — parsed defensively
// since a malformed/missing box just means we skip cropping, not fail
// the whole submission.
function parseBox(raw: unknown): Box | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 4 || !parsed.every((n) => typeof n === "number")) {
      return undefined;
    }
    const [x1, y1, x2, y2] = parsed;
    return { x1, y1, x2, y2 };
  } catch {
    return undefined;
  }
}

ingestRouter.post("/ingest/frigate", requireIngestSecret, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided. Attach one under the 'image' field." });
      return;
    }

    const score = req.body.score !== undefined ? Number(req.body.score) : undefined;

    await saveStagedImage(req.file.buffer, {
      camera: req.body.camera,
      eventId: req.body.eventId,
      score: score !== undefined && !Number.isNaN(score) ? score : undefined,
      box: parseBox(req.body.box),
    });

    res.status(201).json({ status: "staged" });
  } catch (error) {
    next(error);
  }
});
