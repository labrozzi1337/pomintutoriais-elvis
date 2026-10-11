import type { ServerEnv } from "@/config/env";
import { getServerEnv } from "@/config/env";
import { autenticarRequisicao, type Autenticacao } from "@/integrations/supabase/auth";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { respostaErro } from "@/lib/http";
import { autorizarUsuario, type UsuarioAcesso } from "@/services/administracao-usuarios";

export type ApiContext = { ok: true; env: ServerEnv; auth: Extract<Autenticacao, { ok: true }> & { acesso: UsuarioAcesso } } | { ok: false; response: Response };

/** Valida configuração e identidade antes de qualquer operação de domínio. */
export async function obterContextoApi(request: Request): Promise<ApiContext> {
  const env = getServerEnv();
  if (!env.ok) return { ok: false, response: respostaErro("CONFIGURATION_ERROR", "O servidor não está configurado.", 503) };
  const auth = await autenticarRequisicao(request, env.data);
  if (!auth.ok) return { ok: false, response: respostaErro("AUTH_REQUIRED", "Faça login para continuar.", 401) };
  const acesso = await autorizarUsuario(createServerSupabaseClient(env.data), auth.usuario);
  if (!acesso) return { ok: false, response: respostaErro("FORBIDDEN", "Seu e-mail não está liberado para acessar esta plataforma.", 403) };
  return { ok: true, env: env.data, auth: { ...auth, acesso } };
}
