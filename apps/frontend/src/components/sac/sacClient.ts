import type { SupabaseClient } from "@supabase/supabase-js";

export type SacStatus = "open" | "in_analysis" | "in_progress" | "waiting_user" | "resolved" | "closed" | "cancelled";
export type SacTicket = { id: string; ticket_number: number; title: string; description: string; type: string; priority: string; status: SacStatus; assignee_name: string | null; comments_count: number; created_at: string };
export type SacComment = { id: string; author_name?: string; body: string; created_at: string };
export type SacConfig = { supabase: SupabaseClient; systemSlug: string; attachmentUploadToken?: string; getCurrentUser: () => Promise<{ authId: string; email?: string; name?: string } | null> | { authId: string; email?: string; name?: string } | null };

async function identidade(config: SacConfig) {
  const usuario = await config.getCurrentUser();
  if (!usuario?.email) throw new Error("Usuário sem e-mail para abrir chamado.");
  if (!config.attachmentUploadToken) throw new Error("Integração do SAC ainda não configurada neste ambiente.");
  return usuario;
}

export async function listarChamados(config: SacConfig): Promise<SacTicket[]> {
  const usuario = await identidade(config);
  const resultado = await config.supabase.rpc("pominsac_external_list_tickets", { p_token: config.attachmentUploadToken, p_email: usuario.email, p_system_slug: config.systemSlug }) as { data: unknown; error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
  return (resultado.data ?? []) as SacTicket[];
}

export async function criarChamado(config: SacConfig, entrada: { title: string; description: string; type: string; priority: string }, anexo?: Blob | null): Promise<SacTicket> {
  const usuario = await identidade(config);
  let description = entrada.description.trim();
  if (anexo) description += `\n\n![captura](${await enviarAnexo(config, usuario.email!, usuario.name, anexo)})`;
  const resultado = await config.supabase.rpc("pominsac_external_create_ticket", { p_token: config.attachmentUploadToken, p_email: usuario.email, p_name: usuario.name ?? null, p_system_slug: config.systemSlug, p_title: entrada.title.trim(), p_description: description, p_type: entrada.type, p_priority: entrada.priority }) as { data: unknown; error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
  const chamados = await listarChamados(config);
  const criado = chamados.find((chamado) => chamado.id === resultado.data);
  if (!criado) throw new Error("Chamado criado, mas ainda não apareceu na listagem.");
  return criado;
}

export async function listarComentarios(config: SacConfig, ticketId: string): Promise<SacComment[]> {
  const usuario = await identidade(config);
  const resultado = await config.supabase.rpc("pominsac_external_list_comments", { p_token: config.attachmentUploadToken, p_email: usuario.email, p_ticket_id: ticketId }) as { data: unknown; error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
  return (resultado.data ?? []) as SacComment[];
}

export async function comentar(config: SacConfig, ticketId: string, body: string): Promise<void> {
  const usuario = await identidade(config);
  const resultado = await config.supabase.rpc("pominsac_external_add_comment", { p_token: config.attachmentUploadToken, p_email: usuario.email, p_ticket_id: ticketId, p_body: body.trim() }) as { error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
}

export async function cancelarChamado(config: SacConfig, ticketId: string): Promise<void> {
  const usuario = await identidade(config);
  const resultado = await config.supabase.rpc("pominsac_external_cancel_ticket", { p_token: config.attachmentUploadToken, p_email: usuario.email, p_ticket_id: ticketId }) as { error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
}

async function enviarAnexo(config: SacConfig, email: string, nome: string | undefined, anexo: Blob): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": anexo.type || "image/png", "x-pominsac-attachment-token": config.attachmentUploadToken!, "x-pominsac-email": email, "x-pominsac-system-slug": config.systemSlug };
  if (nome) headers["x-pominsac-name"] = nome;
  const resultado = await config.supabase.functions.invoke<{ url?: string; error?: string }>("pominsac-attachment-upload", { body: anexo, headers }) as { data: { url?: string; error?: string } | null; error: { message: string } | null };
  if (resultado.error) throw new Error(resultado.error.message);
  if (!resultado.data?.url) throw new Error(resultado.data?.error ?? "O SAC não retornou a URL do anexo.");
  return resultado.data.url;
}

export function separarAnexos(descricao: string) {
  const anexos: string[] = [];
  const texto = descricao.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (_match, url: string) => { anexos.push(url); return ""; }).trim();
  return { texto, anexos };
}
