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
  isPublic: boolean;
}

export interface HistoryIdentification extends StoredIdentification {
  email: string | null;
}

// Deliberately excludes anything identifying the uploader — this listing is
// meant to eventually be reachable without being signed in at all, so it's
// designed privacy-safe from the start rather than needing redaction later.
export interface PublicIdentification extends BirdIdentification {
  id: string;
  createdAt: string;
  imageUrl: string;
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
  is_public: boolean;
  public_image_path: string | null;
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

type PathRow = Pick<IdentificationRow, "image_path" | "public_image_path">;

// Rows carry both their private path and, if ever shared, a separate
// public copy — deleting an identification has to clean up whichever of
// the two actually exist, not just image_path.
function collectStoragePaths(rows: PathRow[]): string[] {
  const paths: string[] = [];
  for (const row of rows) {
    paths.push(row.image_path);
    if (row.public_image_path) paths.push(row.public_image_path);
  }
  return paths;
}

// Identifications carry a foreign key to app_users, so this has to run
// before an app_users row can be deleted — storage objects aren't covered
// by that constraint and would otherwise be orphaned.
export async function deleteAllForUser(clerkUserId: string): Promise<void> {
  const { data, error } = await supabase
    .from("identifications")
    .select("image_path, public_image_path")
    .eq("clerk_user_id", clerkUserId)
    .returns<PathRow[]>();
  if (error) throw error;

  const paths = collectStoragePaths(data);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
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
    isPublic: row.is_public,
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
    isPublic: data.is_public,
  };
}

// image_path embeds the owner's clerk_user_id (e.g. "user_.../<uuid>.jpg"),
// which is fine for a signed URL only the owner or an admin ever sees — but
// a publicly-shared identification's URL is handed to anyone, including
// signed-out visitors once /community goes public. So sharing copies the
// image to a path with no user-id in it at all, and unsharing removes that
// copy again, rather than ever generating a public URL from image_path.
async function applyPublicSharingChange(
  row: IdentificationRow,
  isPublic: boolean,
): Promise<{ is_public: boolean; public_image_path: string | null }> {
  if (isPublic) {
    if (row.public_image_path) return { is_public: true, public_image_path: row.public_image_path };

    const ext = row.image_path.split(".").pop();
    const publicPath = `public/${randomUUID()}.${ext}`;
    const { error: copyError } = await supabase.storage.from(BUCKET).copy(row.image_path, publicPath);
    if (copyError) throw copyError;
    return { is_public: true, public_image_path: publicPath };
  }

  if (row.public_image_path) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([row.public_image_path]);
    if (removeError) throw removeError;
  }
  return { is_public: false, public_image_path: null };
}

// Ownership-checked — only the person who owns an identification can flip
// its sharing status. Returns null (rather than throwing) when the id
// doesn't exist or isn't owned by this caller, same shape as a "not found".
export async function setIdentificationPublic(
  id: string,
  clerkUserId: string,
  isPublic: boolean,
): Promise<StoredIdentification | null> {
  const { data: existing, error: fetchError } = await supabase
    .from("identifications")
    .select("*")
    .eq("id", id)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle<IdentificationRow>();
  if (fetchError) throw fetchError;
  if (!existing) return null;

  const changes = await applyPublicSharingChange(existing, isPublic);

  const { data, error } = await supabase
    .from("identifications")
    .update(changes)
    .eq("id", id)
    .select()
    .single<IdentificationRow>();
  if (error) throw error;

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
    isPublic: data.is_public,
  };
}

export async function listPublicIdentifications(limit: number, offset: number): Promise<PublicIdentification[]> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*")
    .eq("is_public", true)
    .not("public_image_path", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<IdentificationRow[]>();
  if (error) throw error;
  if (data.length === 0) return [];

  // Always public_image_path here, never image_path — that's the whole
  // point of the copy-on-share step above.
  const { data: signedUrls, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      data.map((row) => row.public_image_path as string),
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

// Not ownership-checked (unlike getIdentificationById) — any signed-in user
// can view any publicly-shared identification, not just their own. Still
// filters on is_public so an id someone stopped sharing 404s immediately.
export async function getPublicIdentificationById(id: string): Promise<PublicIdentification | null> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle<IdentificationRow>();
  if (error) throw error;
  if (!data || !data.public_image_path) return null;

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.public_image_path, SIGNED_URL_TTL_SECONDS);
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

function mapRowWithUser(row: IdentificationRowWithUser, imageUrl: string): HistoryIdentification {
  return {
    id: row.id,
    createdAt: row.created_at,
    imageUrl,
    isBird: row.is_bird,
    isFictionalOrCostume: row.is_fictional_or_costume,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    confidence: row.confidence,
    description: row.description,
    alternativePossibilities: row.alternative_possibilities,
    isPublic: row.is_public,
    email: row.app_users?.email ?? null,
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

  return data.map((row, index) => mapRowWithUser(row, signedUrls[index]?.signedUrl ?? ""));
}

// Admin-only, no ownership filter — any admin can view any user's
// identification, unlike getIdentificationById which is scoped to the
// caller's own.
export async function getAnyIdentificationById(id: string): Promise<HistoryIdentification | null> {
  const { data, error } = await supabase
    .from("identifications")
    .select("*, app_users(email)")
    .eq("id", id)
    .maybeSingle<IdentificationRowWithUser>();
  if (error) throw error;
  if (!data) return null;

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.image_path, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return mapRowWithUser(data, signedUrlData.signedUrl);
}

// Admin-only, no ownership filter — lets an admin curate what's publicly
// visible regardless of who originally uploaded it (e.g. sharing a good
// Frigate catch that got approved under someone else's account).
export async function setAnyIdentificationPublic(id: string, isPublic: boolean): Promise<HistoryIdentification | null> {
  const { data: existing, error: fetchError } = await supabase
    .from("identifications")
    .select("*, app_users(email)")
    .eq("id", id)
    .maybeSingle<IdentificationRowWithUser>();
  if (fetchError) throw fetchError;
  if (!existing) return null;

  const changes = await applyPublicSharingChange(existing, isPublic);

  const { data, error } = await supabase
    .from("identifications")
    .update(changes)
    .eq("id", id)
    .select("*, app_users(email)")
    .single<IdentificationRowWithUser>();
  if (error) throw error;

  const { data: signedUrlData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.image_path, SIGNED_URL_TTL_SECONDS);
  if (signError) throw signError;

  return mapRowWithUser(data, signedUrlData.signedUrl);
}

export async function deleteIdentifications(ids: string[]): Promise<void> {
  const { data, error } = await supabase
    .from("identifications")
    .select("image_path, public_image_path")
    .in("id", ids)
    .returns<PathRow[]>();
  if (error) throw error;

  const paths = collectStoragePaths(data);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await supabase.from("identifications").delete().in("id", ids);
  if (deleteError) throw deleteError;
}
