import { createClient } from "@supabase/supabase-js";
import type { ServerEnv } from "@/config/env";
import type { Database } from "@/integrations/supabase/database.types";

const DATABASE_SCHEMA = "tutoriais";

/** Cria o cliente privilegiado reservado a health check e jobs internos validados. */
export function createServerSupabaseClient(env: ServerEnv) {
  return createClient<Database, typeof DATABASE_SCHEMA>(env.START_BACK_SUPABASE_URL, env.START_BACK_SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    db: { schema: DATABASE_SCHEMA }
  });
}

export type ServerSupabaseClient = ReturnType<typeof createServerSupabaseClient>;

