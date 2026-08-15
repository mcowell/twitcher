import { Router } from "express";
import { upload } from "../middleware/upload";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { identifyBird } from "../services/birdIdentification";
import { saveIdentification } from "../services/identifications";

export const identifyRouter = Router();

identifyRouter.post(
  "/identify",
  requireClerkAuth,
  requireApproval,
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file provided. Attach one under the 'image' field." });
        return;
      }

      const mimeType = req.file.mimetype as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      const result = await identifyBird(req.file.buffer, mimeType);
      res.json(result);

      // Best-effort: persisting the "last 3" history shouldn't fail the
      // identification response the user is actually waiting on.
      saveIdentification(req.userId as string, req.file.buffer, mimeType, result).catch((error) => {
        console.error("Failed to save identification history:", error);
      });
    } catch (error) {
      next(error);
    }
  },
);
