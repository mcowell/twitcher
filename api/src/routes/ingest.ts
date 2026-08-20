import { Router } from "express";
import { upload } from "../middleware/upload";
import { requireIngestSecret } from "../middleware/ingestAuth";
import { saveStagedImage } from "../services/stagedImages";

export const ingestRouter = Router();

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
    });

    res.status(201).json({ status: "staged" });
  } catch (error) {
    next(error);
  }
});
