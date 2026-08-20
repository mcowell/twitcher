import { randomUUID } from "crypto";
import sharp from "sharp";
import { supabase } from "./supabase";
import { identifyBird } from "./birdIdentification";
import { saveIdentification } from "./identifications";
import { computeCropRect, type Box } from "./imageCrop";

const BUCKET = "staged-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface StagedImageMetadata {
  camera?: string;
  eventId?: string;
  score?: number;
  box?: Box;
}

// Best-effort — a crop failure (missing box, corrupt image, whatever) isn't
// worth losing the detection over. Frigate's full frame is still useful
// input for identification, just less ideal than a cropped one.
async function cropToBox(imageBuffer: Buffer, box: Box): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error("Could not read image dimensions.");

  const cropRect = computeCropRect(box, width, height);
  return image.extract(cropRect).toBuffer();
}

export interface StagedImage extends StagedImageMetadata {
  id: string;
  createdAt: string;
  imageUrl: string;
}

interface StagedImageRow {
  id: string;
  image_path: string;
  camera: string | null;
  event_id: string | null;
  score: number | null;
  created_at: string;
}

export async function saveStagedImage(imageBuffer: Buffer, metadata: StagedImageMetadata): Promise<void> {
  let finalBuffer = imageBuffer;
  if (metadata.box) {
    try {
      finalBuffer = await cropToBox(imageBuffer, metadata.box);
    } catch (error) {
      console.error("Failed to crop staged image, storing the full frame instead:", error);
    }
  }

  const imagePath = `${randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, finalBuffer, { contentType: "image/jpeg" });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("staged_images").insert({
    image_path: imagePath,
    camera: metadata.camera ?? null,
    event_id: metadata.eventId ?? null,
    score: metadata.score ?? null,
  });
  if (insertError) throw insertError;
}

export async function listStagedImages(): Promise<StagedImage[]> {
  const { data, error } = await supabase
    .from("staged_images")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<StagedImageRow[]>();
  if (error) throw error;
  if (data.length === 0) return [];

  const { data: signedUrls, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      data.map((row) => row.image_path),
      SIGNED_URL_TTL_SECONDS,
    );
  if (signError) throw signError;

  return data.map((row, index) => ({
    id: row.id,
    createdAt: row.created_at,
    imageUrl: signedUrls[index]?.signedUrl ?? "",
    camera: row.camera ?? undefined,
    eventId: row.event_id ?? undefined,
    score: row.score ?? undefined,
  }));
}

async function fetchStagedRows(ids: string[]): Promise<StagedImageRow[]> {
  const { data, error } = await supabase
    .from("staged_images")
    .select("*")
    .in("id", ids)
    .returns<StagedImageRow[]>();
  if (error) throw error;
  return data;
}

async function removeStagedRows(rows: StagedImageRow[]): Promise<void> {
  if (rows.length === 0) return;

  const { error: removeError } = await supabase.storage.from(BUCKET).remove(rows.map((row) => row.image_path));
  if (removeError) throw removeError;

  const { error: deleteError } = await supabase
    .from("staged_images")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id),
    );
  if (deleteError) throw deleteError;
}

export async function deleteStagedImages(ids: string[]): Promise<void> {
  const rows = await fetchStagedRows(ids);
  await removeStagedRows(rows);
}

export interface ApproveResult {
  id: string;
  ok: boolean;
  isBird?: boolean;
  error?: string;
}

// Runs identification on each selected staged image and, for real bird
// sightings, saves it into the same identifications table (and "recently
// identified" strip) as any other identification — attributed to whichever
// admin clicked Approve. Every selected image is removed from the queue
// once processed, whether or not it turned out to actually be a bird,
// since the point of the queue is deciding what to spend a Claude call on,
// not guaranteeing every approval is a hit.
export async function approveStagedImages(ids: string[], approvedByClerkUserId: string): Promise<ApproveResult[]> {
  const rows = await fetchStagedRows(ids);

  const results = await Promise.all(
    rows.map(async (row): Promise<ApproveResult> => {
      try {
        const { data: imageBlob, error: downloadError } = await supabase.storage.from(BUCKET).download(
          row.image_path,
        );
        if (downloadError) throw downloadError;

        const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
        const result = await identifyBird(imageBuffer, "image/jpeg");

        if (result.isBird) {
          await saveIdentification(approvedByClerkUserId, imageBuffer, "image/jpeg", result);
        }

        return { id: row.id, ok: true, isBird: result.isBird };
      } catch (error) {
        return { id: row.id, ok: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    }),
  );

  await removeStagedRows(rows);
  return results;
}
