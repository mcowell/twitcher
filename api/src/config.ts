import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
  supabaseUrl: requireEnv("SUPABASE_URL"),
  // Service-role key — full access, server-only. Never send this to the
  // browser. The API is the only thing that talks to Supabase; there's no
  // client-side Supabase usage and no RLS policy relies on it.
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  // Comma-separated list of origins allowed to call this API (both for CORS
  // and as the Clerk `authorizedParties` allowlist, so a token minted for
  // one frontend can't be replayed against this API from somewhere else).
  allowedOrigins: requireEnv("ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Generous on purpose — modern phone cameras routinely produce 10-20MB
  // JPEGs. The /identify route resizes/re-encodes before ever calling
  // Claude or storing anything, so accepting a large original doesn't mean
  // a large payload gets sent or stored downstream.
  maxUploadBytes: 25 * 1024 * 1024, // 25MB
  // Fastmail SMTP, used only to notify admins when a new account signs up
  // and needs approval. smtpUser is the Fastmail account login (not
  // necessarily the same as the From address below), authenticated with an
  // app-specific password scoped to SMTP, not the account password.
  smtpUser: requireEnv("SMTP_USER"),
  smtpPassword: requireEnv("SMTP_PASSWORD"),
  // Must be an address/alias already verified as sendable in Fastmail.
  notificationFromEmail: requireEnv("NOTIFICATION_FROM_EMAIL"),
  // Static shared secret for the Frigate ingestion route — there's no human
  // signing in on that path, so a Clerk JWT doesn't apply. Scoped to only
  // that one route (see requireIngestSecret).
  frigateIngestSecret: requireEnv("FRIGATE_INGEST_SECRET"),
  // The web frontend's public URL, e.g. "https://twitcher.yourdomain.com" —
  // used only to build full links in emails (approval notifications, the
  // admin new-signup alert). No trailing slash.
  appUrl: requireEnv("APP_URL"),
};
