import { Router } from "express";
import sharp from "sharp";
import { upload } from "../middleware/upload";
import { requireClerkAuth } from "../middleware/auth";
import { requireApproval } from "../middleware/approval";
import { identifyBird } from "../services/birdIdentification";
import { saveIdentification } from "../services/identifications";

export const identifyRouter = Router();

// Claude's vision performs best with images no larger than ~1568px on the
// long edge — bigger just gets downscaled internally anyway, so this avoids
// wasting bandwidth/tokens on detail Claude will never use, and keeps the
// payload comfortably under Anthropic's base64 image limits. The resized
// buffer is also what gets stored, rather than the raw original, since the
// app never displays anything close to full phone-camera resolution anyway.
const MAX_IDENTIFY_DIMENSION = 1568;
const IDENTIFY_JPEG_QUALITY = 90;

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

      // .autoOrient() bakes in any EXIF "rotate this for display" tag before
      // resizing — skipping it silently drops the tag on re-encode and shows
      // the raw, unrotated pixels (the exact bug fixed on /community's share
      // path).
      const resizedBuffer = await sharp(req.file.buffer)
        .autoOrient()
        .resize({
          width: MAX_IDENTIFY_DIMENSION,
          height: MAX_IDENTIFY_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: IDENTIFY_JPEG_QUALITY })
        .toBuffer();

      const result = await identifyBird(resizedBuffer, "image/jpeg");
      res.json(result);

      // Only persist actual bird sightings (not "no bird detected" misses) —
      // best-effort, so a storage hiccup shouldn't fail the identification
      // response the user is actually waiting on.
      if (result.isBird) {
        saveIdentification(req.userId as string, resizedBuffer, "image/jpeg", result).catch((error) => {
          console.error("Failed to save identification history:", error);
        });
      }
    } catch (error) {
      next(error);
    }
  },
);
