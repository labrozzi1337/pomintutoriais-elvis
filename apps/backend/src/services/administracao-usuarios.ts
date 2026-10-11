import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import { log } from "@/lib/logger";

export type UsuarioAcesso = Database["tutoriais"]["Tables"]["usuarios"]["Row"];
type Usuario = UsuarioAcesso;
type NovoUsuario = { email: string; nome?: string; tipo: "comum" | "admin"; metodo: "local" | "microsoft"; senha?: string };

/** Autoriza por perfil local e religa o mesmo e-mail quando a pessoa troca senha por Microsoft SSO. */
export async function autorizarUsuario(cliente: ServerSupabaseClient, identidade: User): Promise<Usuario | null> {
  const { data: perfilVinculado, error } = await cliente.from("usuarios").select("*").eq("auth_id", identidade.id).maybeSingle();
  let perfil = perfilVinculado;
  if (error) throw new Error("USER_ACCESS_FAILED", { cause: error });
  const email = identidade.email?.trim().toLocaleLowerCase();
  if (!perfil && email) {
    const resultado = await cliente.from("usuarios").select("*").ilike("email", email).maybeSingle();
    if (resultado.error) throw new Error("USER_ACCESS_FAILED", { cause: resultado.error });
    perfil = resultado.data;
  }
  if (!perfil || perfil.status !== "ativo") return null;
  if (perfil.auth_id !== identidade.id) {
    const { data, error: vinculoError } = await cliente.from("usuarios").update({ auth_id: identidade.id, atualizado_em: new Date().toISOString() }).eq("id", perfil.id).select().single();
    if (vinculoError) throw new Error("USER_LINK_FAILED", { cause: vinculoError });
    perfil = data;
  }
  return perfil;
}

async function contasAuth(cliente: ServerSupabaseClient): Promise<User[]> {
  const usuarios: User[] = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await cliente.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw new Error("AUTH_USER_LIST_FAILED", { cause: error });
    usuarios.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return usuarios;
}

export async function listarUsuarios(cliente: ServerSupabaseClient) {
  const [{ data: perfis, error }, identidades] = await Promise.all([
    cliente.from("usuarios").select("*").order("criado_em", { ascending: false }),
    contasAuth(cliente).catch(() => {
      log("warn", "Identidades indisponíveis; exibindo os perfis cadastrados.", { event: "auth.users_list_unavailable", errorCode: "AUTH_USER_LIST_FAILED" });
      return [];
    })
  ]);
  if (error) throw new Error("USER_LIST_FAILED", { cause: error });
  return perfis.map((perfil) => {
    const identidade = identidades.find((item) => item.id === perfil.auth_id || item.email?.toLocaleLowerCase() === perfil.email.toLocaleLowerCase());
    return { ...perfil, confirmado: Boolean(identidade?.email_confirmed_at || perfil.auth_id), ultimoAcessoEm: identidade?.last_sign_in_at ?? null };
  });
}

export async function criarUsuario(cliente: ServerSupabaseClient, entrada: NovoUsuario): Promise<Usuario> {
  const email = entrada.email.trim().toLocaleLowerCase();
  const { data: existente, error: consultaError } = await cliente.from("usuarios").select("id").ilike("email", email).maybeSingle();
  if (consultaError) throw new Error("USER_GET_FAILED", { cause: consultaError });
  if (existente) throw new Error("USER_ALREADY_EXISTS");

  let authId: string | null = null;
  let identidadeNova = false;
  if (entrada.metodo === "local") {
    const criada = await cliente.auth.admin.createUser({ email, password: entrada.senha!, email_confirm: true, user_metadata: { name: entrada.nome ?? null } });
    if (criada.error) {
      if (!/already/i.test(criada.error.message)) throw new Error("AUTH_USER_CREATE_FAILED", { cause: criada.error });
      authId = (await contasAuth(cliente)).find((item) => item.email?.toLocaleLowerCase() === email)?.id ?? null;
      if (!authId) throw new Error("AUTH_USER_NOT_FOUND");
      const { error: atualizarError } = await cliente.auth.admin.updateUserById(authId, { password: entrada.senha!, user_metadata: { name: entrada.nome ?? null } });
      if (atualizarError) throw new Error("AUTH_USER_UPDATE_FAILED", { cause: atualizarError });
    } else { authId = criada.data.user.id; identidadeNova = true; }
  }

  const { data, error } = await cliente.from("usuarios").insert({ auth_id: authId, email, nome: entrada.nome?.trim() || null, tipo: entrada.tipo, metodo: entrada.metodo }).select().single();
  if (error) {
    if (identidadeNova && authId) await cliente.auth.admin.deleteUser(authId);
    throw new Error("USER_PROFILE_CREATE_FAILED", { cause: error });
  }
  return data;
}

export async function excluirUsuario(cliente: ServerSupabaseClient, usuarioId: string, identidadeAtual: string): Promise<boolean> {
  const { data: perfil, error: consultaError } = await cliente.from("usuarios").select("*").eq("id", usuarioId).maybeSingle();
  if (consultaError) throw new Error("USER_GET_FAILED", { cause: consultaError });
  if (!perfil) return false;
  if (perfil.auth_id === identidadeAtual) throw new Error("USER_SELF_DELETE");
  const { error } = await cliente.from("usuarios").delete().eq("id", usuarioId);
  if (error) throw new Error("USER_DELETE_FAILED", { cause: error });
  // A identidade fica revogada pelo perfil ausente; preservá-la evita cascata nos registros que ela criou.
  return true;
}

export async function alterarTipoUsuario(cliente: ServerSupabaseClient, usuarioId: string, tipo: "comum" | "admin", identidadeAtual: string): Promise<Usuario | null> {
  const { data: atual, error: consultaError } = await cliente.from("usuarios").select("*").eq("id", usuarioId).maybeSingle();
  if (consultaError) throw new Error("USER_GET_FAILED", { cause: consultaError });
  if (!atual) return null;
  if (atual.auth_id === identidadeAtual && tipo !== "admin") throw new Error("USER_SELF_DEMOTE");
  const { data, error } = await cliente.from("usuarios").update({ tipo, atualizado_em: new Date().toISOString() }).eq("id", usuarioId).select().single();
  if (error) throw new Error("USER_ROLE_UPDATE_FAILED", { cause: error });
  return data;
}
