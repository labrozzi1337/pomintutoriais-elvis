import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { ServerEnv } from "@/config/env";
import type { Database } from "@/integrations/supabase/database.types";

const DATABASE_SCHEMA = "tutoriais";

export type AuthenticatedSupabaseClient = ReturnType<typeof criarClienteAutenticado>;
export type Autenticacao = { ok: true; usuario: User; cliente: AuthenticatedSupabaseClient } | { ok: false };

/** Valida o Bearer no Supabase e devolve um cliente sujeito às policies RLS do usuário. */
export async function autenticarRequisicao(request: Request, env: ServerEnv): Promise<Autenticacao> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { ok: false };

  const token = authorization.slice(7).trim();
  if (!token) return { ok: false };

  const cliente = criarClienteAutenticado(env, token);
  const { data, error } = await cliente.auth.getUser(token);
  return error || !data.user ? { ok: false } : { ok: true, usuario: data.user, cliente };
}

/** Cria um cliente PostgREST com o JWT do chamador sem persistir sessão no servidor. */
function criarClienteAutenticado(env: ServerEnv, token: string) {
  return createClient<Database, typeof DATABASE_SCHEMA>(env.START_BACK_SUPABASE_URL, env.START_BACK_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
    db: { schema: DATABASE_SCHEMA }
  });
}
