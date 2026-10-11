import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";

export async function listarRecordes(cliente: AuthenticatedSupabaseClient) {
  const { data, error } = await cliente.from("recordes_cobrinha").select("nickname,score,atualizado_em").order("score", { ascending: false }).order("atualizado_em").limit(10);
  if (error) throw new Error("SCORES_LIST_FAILED", { cause: error });
  return data;
}

export async function registrarRecorde(cliente: AuthenticatedSupabaseClient, usuarioId: string, nickname: string, score: number) {
  const { data: atual, error: buscaError } = await cliente.from("recordes_cobrinha").select("score").eq("proprietario_id", usuarioId).maybeSingle();
  if (buscaError) throw new Error("SCORE_GET_FAILED", { cause: buscaError });
  const melhor = Math.max(score, atual?.score ?? 0);
  const { data, error } = await cliente.from("recordes_cobrinha").upsert({ proprietario_id: usuarioId, nickname, score: melhor, atualizado_em: new Date().toISOString() }).select("nickname,score,atualizado_em").single();
  if (error) throw new Error("SCORE_SAVE_FAILED", { cause: error });
  return data;
}
