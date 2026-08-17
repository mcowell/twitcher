import { supabase } from "./supabase";

export async function listNotificationEmails(): Promise<string[]> {
  const { data, error } = await supabase
    .from("notification_emails")
    .select("email")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((row) => row.email as string);
}

export async function addNotificationEmail(email: string): Promise<void> {
  const { error } = await supabase.from("notification_emails").insert({ email });
  // 23505 = unique violation — already on the list, treat as a no-op.
  if (error && error.code !== "23505") throw error;
}

export async function removeNotificationEmail(email: string): Promise<void> {
  const { error } = await supabase.from("notification_emails").delete().eq("email", email);
  if (error) throw error;
}
