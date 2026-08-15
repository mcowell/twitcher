import { Router } from "express";
import { upload } from "../middleware/upload";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { identifyBird } from "../services/birdIdentification";

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

      const result = await identifyBird(
        req.file.buffer,
        req.file.mimetype as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
