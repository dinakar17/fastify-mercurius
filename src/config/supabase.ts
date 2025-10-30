import { createClient } from "@supabase/supabase-js";

/**
 * Admin client for verifying JWT tokens
 * Uses service role key to bypass RLS
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
