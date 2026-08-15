import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

// Server-only client using the service-role key — full table access, no RLS
// involved. This is the only thing in the whole app that talks to Supabase;
// the browser never sees these credentials or queries it directly.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
