import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";
import type { Database, Json } from "@/integrations/supabase/database.types";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import type { ModeloFish } from "@/services/fish-audio";
import type { ModoAudioOriginal } from "@/services/renderizar-narracao";
import { arquivoDoProjeto } from "@/services/vinculo-arquivo";

type Processamento = Database["tutoriais"]["Tables"]["processamentos"]["Row"];
type Bloco = Database["tutoriais"]["Tables"]["blocos"]["Row"];
type Voz = Database["tutoriais"]["Tables"]["vozes"]["Row"];
type Video = Database["tutoriais"]["Tables"]["videos"]["Row"];
type Arquivo = Database["tutoriais"]["Tables"]["arquivos"]["Row"];

export interface ConfiguracaoNarracao {
  roteiroId: string;
  vozId: string;
  modelo: ModeloFish;
  modoAudio: ModoAudioOriginal;
  forcarBlocoId?: string;
  forcarTodos?: boolean;
  ajustarTextoAutomaticamente?: boolean;
  gerarLegendas?: boolean;
  fluxoAutomatico?: boolean;
}

export interface TrabalhoNarracao {
  processamento: Processamento;
  configuracao: ConfiguracaoNarracao;
  blocos: Bloco[];
  voz: Voz;
  video: Video;
  arquivoVideo: Arquivo;
}

/** Persiste uma voz de ambiente sem expor a referência ao navegador. */
async function garantirVoz(cliente: ServerSupabaseClient, referenceId: string, nome: string, modelo: ModeloFish): Promise<Voz> {
  const agora = new Date().toISOString();
  const { data, error } = await cliente.from("vozes").upsert({
    nome, provedor: "fish", referencia_externa: referenceId, ativa: true,
    modelo, configuracao: {}, atualizado_em: agora
  }, { onConflict: "provedor,referencia_externa" }).select().single();
  if (error) throw new Error("VOICE_UPSERT_FAILED", { cause: error });
  return data;
}

/** Registra a voz principal e, quando diferente, a alternativa configurada. */
export async function garantirVozesConfiguradas(cliente: ServerSupabaseClient, referenciaPrincipal: string | undefined, referenciaAlternativa: string | undefined, modelo: ModeloFish): Promise<{ padrao: Voz | null; vozes: Voz[] }> {
  const referenciaPadrao = referenciaPrincipal ?? referenciaAlternativa;
  if (!referenciaPadrao) return { padrao: null, vozes: [] };
  const padrao = await garantirVoz(cliente, referenciaPadrao, "Voz principal", modelo);
  if (!referenciaAlternativa || referenciaAlternativa === referenciaPadrao) return { padrao, vozes: [padrao] };
  const alternativa = await garantirVoz(cliente, referenciaAlternativa, "Voz alternativa", modelo);
  return { padrao, vozes: [padrao, alternativa] };
}

/** Autoriza pelo RLS e cria um único processamento ativo para o roteiro. */
export async function criarProcessamentoNarracao(cliente: AuthenticatedSupabaseClient, configuracao: ConfiguracaoNarracao): Promise<Processamento | null> {
  const { data: roteiro, error } = await cliente.from("roteiros").select("id,projeto_id,status").eq("id", configuracao.roteiroId).maybeSingle();
  if (error) throw new Error("SCRIPT_GET_FAILED", { cause: error });
  if (!roteiro) return null;
  const { data: video, error: videoError } = await cliente.from("videos").select("id").eq("projeto_id", roteiro.projeto_id).eq("status", "pronto").order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (videoError) throw new Error("VIDEO_GET_FAILED", { cause: videoError });
  if (!video) throw new Error("VIDEO_NOT_READY");
  const { data: ativo, error: ativoError } = await cliente.from("processamentos").select("id").eq("video_id", video.id).eq("tipo", "gerar_narracao").not("status", "in", "(concluido,erro,cancelado)").maybeSingle();
  if (ativoError) throw new Error("PROCESSING_GET_FAILED", { cause: ativoError });
  if (ativo) {
    const anterior = await cliente.from("processamentos").select("status").eq("id", ativo.id).single();
    if (anterior.data?.status !== "ajuste_necessario") throw new Error("NARRATION_ALREADY_ACTIVE");
    const cancelamento = await cliente.from("processamentos").update({ status: "cancelado", concluido_em: new Date().toISOString() }).eq("id", ativo.id);
    if (cancelamento.error) throw new Error("NARRATION_CANCEL_FAILED", { cause: cancelamento.error });
  }
  const agora = new Date().toISOString();
  const { data, error: insertError } = await cliente.from("processamentos").insert({
    projeto_id: roteiro.projeto_id, video_id: video.id, tipo: "gerar_narracao", status: "gerando_voz",
    progresso: 0, mensagem: "Narração aguardando o worker.", configuracao: configuracao as unknown as Json,
    criado_em: agora, atualizado_em: agora
  }).select().single();
  if (insertError) throw new Error("NARRATION_CREATE_FAILED", { cause: insertError });
  await cliente.from("projetos").update({ status: "gerando_voz", atualizado_em: agora }).eq("id", roteiro.projeto_id);
  return data;
}

/** Reidrata todo o trabalho a partir de IDs persistidos. */
export async function obterTrabalhoNarracao(cliente: ServerSupabaseClient, processamentoId: string): Promise<TrabalhoNarracao | null> {
  const { data: processamento, error } = await cliente.from("processamentos").select("*").eq("id", processamentoId).eq("tipo", "gerar_narracao").maybeSingle();
  if (error) throw new Error("NARRATION_GET_FAILED", { cause: error });
  if (!processamento?.video_id) return null;
  const configuracao = processamento.configuracao as unknown as ConfiguracaoNarracao;
  const [{ data: blocos, error: blocosError }, { data: voz, error: vozError }, { data: video, error: videoError }] = await Promise.all([
    cliente.from("blocos").select("*").eq("roteiro_id", configuracao.roteiroId).order("ordem"),
    cliente.from("vozes").select("*").eq("id", configuracao.vozId).maybeSingle(),
    cliente.from("videos").select("*").eq("id", processamento.video_id).maybeSingle()
  ]);
  if (blocosError || vozError || videoError) throw new Error("NARRATION_RELATIONS_FAILED", { cause: blocosError ?? vozError ?? videoError });
  if (!voz || !video) return null;
  const roteiro = await cliente.from("roteiros").select("projeto_id").eq("id", configuracao.roteiroId).maybeSingle();
  if (roteiro.error) throw new Error("NARRATION_SCRIPT_GET_FAILED", { cause: roteiro.error });
  if (roteiro.data?.projeto_id !== processamento.projeto_id || video.projeto_id !== processamento.projeto_id) return null;
  const { data: arquivoVideo, error: arquivoError } = await cliente.from("arquivos").select("*").eq("id", video.arquivo_original_id).maybeSingle();
  if (arquivoError) throw new Error("NARRATION_VIDEO_FILE_FAILED", { cause: arquivoError });
  return arquivoVideo && arquivoDoProjeto(processamento.projeto_id, arquivoVideo) ? { processamento, configuracao, blocos: blocos.filter((bloco) => bloco.narracao.trim()), voz, video, arquivoVideo } : null;
}

export async function atualizarEstadoNarracao(cliente: ServerSupabaseClient, id: string, status: string, progresso: number, mensagem: string): Promise<void> {
  const { error } = await cliente.from("processamentos").update({ status, progresso, mensagem, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error("NARRATION_PROGRESS_FAILED", { cause: error });
}

export async function concluirNarracao(cliente: ServerSupabaseClient, trabalho: TrabalhoNarracao, mensagem: string): Promise<void> {
  const agora = new Date().toISOString();
  const [processamento, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status: "concluido", progresso: 100, mensagem, concluido_em: agora, atualizado_em: agora }).eq("id", trabalho.processamento.id),
    cliente.from("projetos").update({ status: "concluido", atualizado_em: agora }).eq("id", trabalho.processamento.projeto_id)
  ]);
  if (processamento.error || projeto.error) throw new Error("NARRATION_COMPLETE_FAILED", { cause: processamento.error ?? projeto.error });
}

export async function falharNarracao(cliente: ServerSupabaseClient, trabalho: TrabalhoNarracao, codigo: string, cancelado = false): Promise<void> {
  const agora = new Date().toISOString();
  const status = cancelado ? "cancelado" : "erro";
  await cliente.from("processamentos").update({ status, codigo_erro: codigo, mensagem: cancelado ? "Narração cancelada." : "Não foi possível concluir a narração.", concluido_em: agora, atualizado_em: agora }).eq("id", trabalho.processamento.id);
  await cliente.from("projetos").update({ status, atualizado_em: agora }).eq("id", trabalho.processamento.projeto_id);
}
