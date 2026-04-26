import { createClient } from "@supabase/supabase-js";
import { env } from "@/server/env";

export function createServiceSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
