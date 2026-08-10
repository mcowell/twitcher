import type { ErrorRequestHandler } from "express";
import multer from "multer";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Image exceeds the maximum allowed size (10MB)." });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof Error && err.message.startsWith("Unsupported file type")) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong while identifying the bird." });
};
