import { supabase } from "./supabase";

const STAGED_RETENTION_KEY = "staged_image_retention_days";

// Applied when no row has been saved yet. 0 means "keep forever".
export const DEFAULT_STAGED_RETENTION_DAYS = 30;
export const MAX_STAGED_RETENTION_DAYS = 3650;

export async function getStagedRetentionDays(): Promise<number> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", STAGED_RETENTION_KEY)
    .maybeSingle();
  if (error) throw error;

  const value = data?.value;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : DEFAULT_STAGED_RETENTION_DAYS;
}

export async function setStagedRetentionDays(days: number): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: STAGED_RETENTION_KEY, value: days, updated_at: new Date().toISOString() });
  if (error) throw error;
}
