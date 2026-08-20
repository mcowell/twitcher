import { supabase } from "./supabase";

const BUCKETS = ["bird-images", "staged-images"];

// list() only returns one directory level at a time — entries with a null
// id are subfolders (bird-images nests images under clerk_user_id/), so
// this recurses into them. A single 1000-item page per folder is plenty
// for how this app is actually used; not worth paginating further.
async function listAllSizes(bucket: string, prefix = ""): Promise<number[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;

  const sizes: number[] = [];
  for (const entry of data) {
    if (entry.id === null) {
      const nested = await listAllSizes(bucket, prefix ? `${prefix}/${entry.name}` : entry.name);
      sizes.push(...nested);
    } else {
      sizes.push(entry.metadata?.size ?? 0);
    }
  }
  return sizes;
}

export interface StorageStats {
  imageCount: number;
  totalBytes: number;
}

export async function getStorageStats(): Promise<StorageStats> {
  const sizesPerBucket = await Promise.all(BUCKETS.map((bucket) => listAllSizes(bucket)));
  const all = sizesPerBucket.flat();

  return {
    imageCount: all.length,
    totalBytes: all.reduce((sum, size) => sum + size, 0),
  };
}
