export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Expand the box by this fraction of its own width/height on each side —
// 0.75 means the final crop is roughly 2.5x the box's size. Generous
// context (a perch, part of the feeder, something to judge scale against)
// without sending Claude the whole wide-angle frame.
const PADDING_FACTOR = 0.75;

// Don't let a tiny/distant detection's box get padded into another tiny
// crop — below this, widen back out toward the frame instead. Percentage
// padding alone can't add resolution that isn't there, but it can at least
// avoid handing Claude a postage stamp.
const MIN_CROP_SIZE = 500;

// Frigate reports `box` as absolute pixel coordinates in normal operation.
// Defensively detect a normalized (0-1) variant too, since real pixel
// coordinates in an actual camera frame essentially never all fall <= 1.
export function computeCropRect(box: Box, frameWidth: number, frameHeight: number): CropRect {
  const isNormalized = Math.max(box.x1, box.y1, box.x2, box.y2) <= 1;
  const x1 = isNormalized ? box.x1 * frameWidth : box.x1;
  const y1 = isNormalized ? box.y1 * frameHeight : box.y1;
  const x2 = isNormalized ? box.x2 * frameWidth : box.x2;
  const y2 = isNormalized ? box.y2 * frameHeight : box.y2;

  const padX = (x2 - x1) * PADDING_FACTOR;
  const padY = (y2 - y1) * PADDING_FACTOR;

  let cropX1 = x1 - padX;
  let cropY1 = y1 - padY;
  let cropX2 = x2 + padX;
  let cropY2 = y2 + padY;

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  if (cropX2 - cropX1 < MIN_CROP_SIZE) {
    cropX1 = centerX - MIN_CROP_SIZE / 2;
    cropX2 = centerX + MIN_CROP_SIZE / 2;
  }
  if (cropY2 - cropY1 < MIN_CROP_SIZE) {
    cropY1 = centerY - MIN_CROP_SIZE / 2;
    cropY2 = centerY + MIN_CROP_SIZE / 2;
  }

  cropX1 = Math.max(0, cropX1);
  cropY1 = Math.max(0, cropY1);
  cropX2 = Math.min(frameWidth, cropX2);
  cropY2 = Math.min(frameHeight, cropY2);

  return {
    left: Math.round(cropX1),
    top: Math.round(cropY1),
    width: Math.round(cropX2 - cropX1),
    height: Math.round(cropY2 - cropY1),
  };
}
