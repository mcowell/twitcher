import { randomUUID } from "crypto";
import { supabase } from "./supabase";
import type { BirdIdentification, SupportedImageMimeType } from "./birdIdentification";

const BUCKET = "bird-images";
// Long enough to cover a page view, short enough that a copied link goes
// stale quickly rather than becoming a durable, unauthenticated image URL.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const EXTENSIONS: Record<SupportedImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface StoredIdentification extends BirdIdentification {
  id: string;
  createdAt: string;
  imageUrl: string;
}

export interface HistoryIdentification extends StoredIdentification {
  email: string | null;
}

interface IdentificationRow {
  id: string;
  image_path: string;
  is_bird: boolean;
  is_fictional_or_costume: boolean;
  common_name: string;
  scientific_name: string;
  confidence: "low" | "medium" | "high";
  description: string;
  alternative_possibilities: BirdIdentification["alternativePossibilities"];
  created_at: string;
}

interface IdentificationRowWithUser extends IdentificationRow {
  app_users: { email: string | null } | null;
}

export async function saveIdentification(
  clerkUserId: string,
  imageBuffer: Buffer,
  mimeType: SupportedImageMimeType,
  result: BirdIdentification,
): Promise<void> {
  const imagePath = `${clerkUserId}/${randomUUID()}.${EXTENSIONS[mimeType]}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, imageBuffer, { contentType: mimeType });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("identifications").insert({
    clerk_user_id: clerkUserId,
    image_path: imagePath,
    is_bird: result.isBird,
    is_fictional_or_costume: result.isFictionalOrCostume,
    common_name: result.commonName,
    scientific_name: result.scientificName,
    confidence: result.confidence,
    description: result.description,
    alternative_possibilities: result.alternativePossibilities,
  });
  if (insertError) throw insertError;
}

// Identifications carry a foreign key to app_users, so this has to run
// before an app_users row can be deleted — storage objects aren't covered
// by that constraint and would otherwise be orphaned.
export async function deleteAllForUser(clerkUserId: string): Promise<void> {
  const { data, error } = await supabase
    .from("identifications")
    .select("image_path")
    .eq("clerk_user_id", clerkUserId)
    .returns<Pick<IdentificationRow, "image_path">[]>();
  if (error) throw error;

  if (data.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(data.map((row) => row.image_path));
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await supabase.from("identifications").delete().eq("clerk_user_id", clerkUserId);
  if (deleteError) throw deleteError;
}

export async function listRecentIdentifications(
  clerkUserId: string,
  limit: number,
  offset = 0,
): Promise<StoredIdentification[]> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<IdentificationRow[]>();
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
    isBird: row.is_bird,
    isFictionalOrCostume: row.is_fictional_or_costume,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    confidence: row.confidence,
    description: row.description,
    alternativePossibilities: row.alternative_possibilities,
  }));
}

// Ownership-checked single lookup for the detail view — filtering by both
// id and clerk_user_id means a user can't view someone else's by guessing
// an id, without needing a separate authorization check layered on top.
export async function getIdentificationById(id: string, clerkUserId: string): Promise<StoredIdentification | null> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*")
    .eq("id", id)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle<IdentificationRow>();
  if (error) throw error;
  if (!data) return null;

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.image_path, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return {
    id: data.id,
    createdAt: data.created_at,
    imageUrl: signedUrlData.signedUrl,
    isBird: data.is_bird,
    isFictionalOrCostume: data.is_fictional_or_costume,
    commonName: data.common_name,
    scientificName: data.scientific_name,
    confidence: data.confidence,
    description: data.description,
    alternativePossibilities: data.alternative_possibilities,
  };
}

// Admin-only view across every user's identifications (not just the
// caller's own), for browsing/cleaning up history — e.g. bulk-approved
// Frigate images. Paginated via limit/offset since this can grow
// unbounded, unlike the home page's fixed "last 3" strip.
export async function listAllIdentifications(limit: number, offset: number): Promise<HistoryIdentification[]> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*, app_users(email)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<IdentificationRowWithUser[]>();
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
    isBird: row.is_bird,
    isFictionalOrCostume: row.is_fictional_or_costume,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    confidence: row.confidence,
    description: row.description,
    alternativePossibilities: row.alternative_possibilities,
    email: row.app_users?.email ?? null,
  }));
}

export async function deleteIdentifications(ids: string[]): Promise<void> {
  const { data, error } = await supabase
    .from("identifications")
    .select("image_path")
    .in("id", ids)
    .returns<Pick<IdentificationRow, "image_path">[]>();
  if (error) throw error;

  if (data.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(data.map((row) => row.image_path));
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await supabase.from("identifications").delete().in("id", ids);
  if (deleteError) throw deleteError;
}
