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
  // Comma-separated list of origins allowed to call this API (both for CORS
  // and as the Clerk `authorizedParties` allowlist, so a token minted for
  // one frontend can't be replayed against this API from somewhere else).
  allowedOrigins: requireEnv("ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxUploadBytes: 10 * 1024 * 1024, // 10MB
};
