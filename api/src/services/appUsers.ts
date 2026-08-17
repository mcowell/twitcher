import { supabase } from "./supabase";
import { clerkClient } from "./clerk";
import { sendMail } from "./mailer";
import { listNotificationEmails } from "./notificationEmails";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AppUser {
  clerkUserId: string;
  email: string | null;
  status: ApprovalStatus;
  createdAt: string;
  approvedAt: string | null;
}

interface AppUserRow {
  clerk_user_id: string;
  email: string | null;
  status: ApprovalStatus;
  created_at: string;
  approved_at: string | null;
}

function mapRow(row: AppUserRow): AppUser {
  return {
    clerkUserId: row.clerk_user_id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

// Every new sign-in lazily creates the app_users row on first sight, as
// "pending" — there's no Clerk webhook wiring, this just runs on whatever
// request happens to see the user first (typically the frontend's post-login
// GET /me check). Approving someone is a manual UPDATE against this table
// for now (see README) — no admin UI yet.
//
// The Clerk session JWT has no email claim, so email is only fetched from
// the Clerk Backend API on the (rare) insert path — not on every request —
// purely so a human approving via Supabase's table editor has something
// more useful to go on than an opaque user ID.
export async function getOrCreateAppUser(clerkUserId: string): Promise<AppUser> {
  const { data: existing, error: selectError } = await supabase
    .from("app_users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle<AppUserRow>();

  if (selectError) throw selectError;
  if (existing) return mapRow(existing);

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? null;

  const { data: created, error: insertError } = await supabase
    .from("app_users")
    .insert({ clerk_user_id: clerkUserId, email })
    .select()
    .single<AppUserRow>();

  if (insertError) {
    // Two near-simultaneous first requests from the same brand-new user can
    // both reach here; the loser hits the primary key constraint instead of
    // a real error, so just re-read what the winner inserted.
    if (insertError.code === "23505") {
      const { data: retried, error: retryError } = await supabase
        .from("app_users")
        .select("*")
        .eq("clerk_user_id", clerkUserId)
        .single<AppUserRow>();
      if (retryError) throw retryError;
      return mapRow(retried);
    }
    throw insertError;
  }

  // Best-effort — a notification failure shouldn't block the signup itself,
  // and this only fires on the actual insert, not on repeat visits.
  notifyAdminsOfNewSignup(email).catch((error) => {
    console.error("Failed to send new-signup notification:", error);
  });

  return mapRow(created);
}

async function notifyAdminsOfNewSignup(email: string | null): Promise<void> {
  const recipients = await listNotificationEmails();
  if (recipients.length === 0) return;

  await sendMail(
    recipients,
    "Twitcher: new account needs approval",
    `${email ?? "A new user"} just signed up and is waiting for approval.\n\nApprove at: /admin`,
  );
}

export async function listAppUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as AppUserRow[]).map(mapRow);
}

export async function updateAppUserStatus(clerkUserId: string, status: ApprovalStatus): Promise<AppUser> {
  const { data, error } = await supabase
    .from("app_users")
    .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
    .eq("clerk_user_id", clerkUserId)
    .select()
    .single<AppUserRow>();

  if (error) throw error;
  return mapRow(data);
}
