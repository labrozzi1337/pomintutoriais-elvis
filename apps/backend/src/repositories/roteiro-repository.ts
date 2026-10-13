import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";
import type { Database, Json } from "@/integrations/supabase/database.types";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import type { BlocoTimeline } from "@/services/timeline";
import { arquivoDoProjeto } from "@/services/vinculo-arquivo";

type Roteiro = Database["tutoriais"]["Tables"]["roteiros"]["Row"];
type Bloco = Database["tutoriais"]["Tables"]["blocos"]["Row"];

export interface RoteiroDetalhado extends Roteiro {
  blocos: Array<Bloco & { duracaoDisponivelMs: number; narracaoGerada: Database["tutoriais"]["Tables"]["narracoes"]["Row"] | null }>;
  arquivosGerados: Database["tutoriais"]["Tables"]["arquivos"]["Row"][];
  historico: Database["tutoriais"]["Tables"]["roteiro_eventos"]["Row"][];
}

/** Agenda análise somente para vídeo autorizado e exige confirmação antes de substituir edição humana. */
export async function criarAnalise(cliente: AuthenticatedSupabaseClient, videoId: string, usuarioId: string, confirmarSubstituicao: boolean, configuracao: Json = {}) {
  const { data: video, error: videoError } = await cliente.from("videos").select("id,projeto_id,status,duracao_ms").eq("id", videoId).maybeSingle();
  if (videoError) throw new Error("VIDEO_GET_FAILED", { cause: videoError });
  if (!video) return null;
  if (video.status !== "pronto" || !video.duracao_ms) throw new Error("VIDEO_NOT_READY");
  const { data: anterior, error: roteiroError } = await cliente.from("roteiros").select("id,edicoes_humanas").eq("projeto_id", video.projeto_id).order("versao", { ascending: false }).limit(1).maybeSingle();
  if (roteiroError) throw new Error("SCRIPT_GET_FAILED", { cause: roteiroError });
  if (anterior?.edicoes_humanas && !confirmarSubstituicao) throw new Error("SCRIPT_REPLACEMENT_CONFIRMATION_REQUIRED");
  const agora = new Date().toISOString();
  // Jobs antigos marcados roteiro_pronto já terminaram, mas ainda ocupam o índice de ativos.
  const legados = await cliente.from("processamentos").update({ status: "concluido", atualizado_em: agora }).eq("video_id", video.id).eq("tipo", "analisar_video").eq("status", "roteiro_pronto").not("concluido_em", "is", null);
  if (legados.error) throw new Error("ANALYSIS_LEGACY_COMPLETE_FAILED", { cause: legados.error });
  const { data, error } = await cliente.from("processamentos").insert({
    projeto_id: video.projeto_id, video_id: video.id, tipo: "analisar_video", status: "recebido",
    progresso: 0, mensagem: "Análise aguardando o worker.", configuracao, criado_em: agora, atualizado_em: agora
  }).select().single();
  if (error) throw new Error(error.code === "23505" ? "ANALYSIS_ALREADY_ACTIVE" : "ANALYSIS_CREATE_FAILED", { cause: error });
  if (anterior) await cliente.from("roteiro_eventos").insert({ roteiro_id: anterior.id, usuario_id: usuarioId, tipo: "analise_solicitada", dados: { videoId } });
  return data;
}

/** Retorna o roteiro mais recente do projeto autorizado e calcula a janela de cada bloco. */
export async function obterRoteiroAtual(cliente: AuthenticatedSupabaseClient, projetoId: string): Promise<RoteiroDetalhado | null> {
  const { data: roteiro, error } = await cliente.from("roteiros").select("*").eq("projeto_id", projetoId).neq("status", "substituido").order("versao", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("SCRIPT_GET_FAILED", { cause: error });
  if (!roteiro) return null;
  const { data: blocos, error: blocosError } = await cliente.from("blocos").select("*").eq("roteiro_id", roteiro.id).order("ordem");
  if (blocosError) throw new Error("SCRIPT_BLOCKS_GET_FAILED", { cause: blocosError });
  const ids = blocos.map((bloco) => bloco.id);
  const [{ data: narracoes, error: narracoesError }, { data: arquivos, error: arquivosError }, { data: historico, error: historicoError }] = await Promise.all([
    ids.length ? cliente.from("narracoes").select("*").in("bloco_id", ids).order("atualizado_em", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    cliente.from("arquivos").select("*").eq("projeto_id", projetoId).in("tipo", ["audio", "video_final", "legenda"]).order("criado_em", { ascending: false }),
    cliente.from("roteiro_eventos").select("*").eq("roteiro_id", roteiro.id).eq("tipo", "timeline_editada").order("criado_em", { ascending: false }).limit(20)
  ]);
  if (narracoesError || arquivosError || historicoError) throw new Error("SCRIPT_AUDIO_GET_FAILED", { cause: narracoesError ?? arquivosError ?? historicoError });
  return {
    ...roteiro,
    blocos: blocos.map((bloco) => ({ ...bloco, duracaoDisponivelMs: bloco.fim_ms - bloco.inicio_ms, narracaoGerada: narracoes.find((item) => {
      const configuracao = item.configuracao as { texto?: string };
      return item.bloco_id === bloco.id && (configuracao.texto !== undefined ? configuracao.texto === bloco.narracao : item.atualizado_em >= bloco.atualizado_em);
    }) ?? null })),
    arquivosGerados: arquivos,
    historico
  };
}

/** Obtém a duração do vídeo associado ao roteiro autorizado para validar edições. */
export async function obterDuracaoRoteiro(cliente: AuthenticatedSupabaseClient, roteiroId: string): Promise<number | null> {
  const { data: roteiro, error } = await cliente.from("roteiros").select("projeto_id").eq("id", roteiroId).maybeSingle();
  if (error) throw new Error("SCRIPT_GET_FAILED", { cause: error });
  if (!roteiro) return null;
  const { data: video, error: videoError } = await cliente.from("videos").select("duracao_ms").eq("projeto_id", roteiro.projeto_id).eq("status", "pronto").order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (videoError) throw new Error("VIDEO_GET_FAILED", { cause: videoError });
  return video?.duracao_ms ?? null;
}

/** Busca dados confiáveis do job de análise usando somente identificadores persistidos. */
export async function obterAnaliseInterna(cliente: ServerSupabaseClient, processamentoId: string) {
  const { data: processamento, error } = await cliente.from("processamentos").select("*").eq("id", processamentoId).eq("tipo", "analisar_video").maybeSingle();
  if (error) throw new Error("INTERNAL_ANALYSIS_GET_FAILED", { cause: error });
  if (!processamento?.video_id) return null;
  const { data: video, error: videoError } = await cliente.from("videos").select("*").eq("id", processamento.video_id).maybeSingle();
  if (videoError) throw new Error("INTERNAL_VIDEO_GET_FAILED", { cause: videoError });
  if (!video) return null;
  const { data: arquivo, error: arquivoError } = await cliente.from("arquivos").select("*").eq("id", video.arquivo_original_id).maybeSingle();
  if (arquivoError) throw new Error("INTERNAL_FILE_GET_FAILED", { cause: arquivoError });
  return arquivo && video.projeto_id === processamento.projeto_id && arquivoDoProjeto(processamento.projeto_id, arquivo) ? { processamento, video, arquivo } : null;
}

/** Persiste um estágio recuperável do pipeline de análise. */
export async function atualizarAnaliseInterna(cliente: ServerSupabaseClient, processamentoId: string, progresso: number, mensagem: string): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await cliente.from("processamentos").update({ status: "analisando", progresso, mensagem, iniciado_em: agora, atualizado_em: agora }).eq("id", processamentoId);
  if (error) throw new Error("ANALYSIS_PROGRESS_FAILED", { cause: error });
}

/** Cria uma nova versão de roteiro, seus blocos e conclui o processamento. */
export async function concluirAnaliseInterna(cliente: ServerSupabaseClient, entrada: {
  processamentoId: string; projetoId: string; videoId: string; modelo: string; promptVersao: string; uso: Json; blocos: BlocoTimeline[];
}): Promise<string> {
  const agora = new Date().toISOString();
  const { data: anterior, error: anteriorError } = await cliente.from("roteiros").select("id,versao").eq("projeto_id", entrada.projetoId).order("versao", { ascending: false }).limit(1).maybeSingle();
  if (anteriorError) throw new Error("SCRIPT_VERSION_GET_FAILED", { cause: anteriorError });
  const { data: roteiro, error } = await cliente.from("roteiros").insert({
    projeto_id: entrada.projetoId, versao: (anterior?.versao ?? 0) + 1, status: "pronto", modelo: entrada.modelo,
    prompt_versao: entrada.promptVersao, uso_provedor: entrada.uso, criado_em: agora, atualizado_em: agora
  }).select().single();
  if (error) throw new Error("SCRIPT_CREATE_FAILED", { cause: error });
  const { error: blocosError } = await cliente.from("blocos").insert(entrada.blocos.map((bloco, ordem) => ({
    roteiro_id: roteiro.id, ordem, inicio_ms: bloco.inicioMs, fim_ms: bloco.fimMs, acao_visual: bloco.acaoVisual,
    narracao: bloco.narracao, evidencias_frame: bloco.evidenciasFrame, confianca: bloco.confianca, status: "pronto",
    criado_em: agora, atualizado_em: agora
  })));
  if (blocosError) {
    await cliente.from("roteiros").delete().eq("id", roteiro.id);
    throw new Error("SCRIPT_BLOCKS_CREATE_FAILED", { cause: blocosError });
  }
  if (anterior) await cliente.from("roteiros").update({ status: "substituido", atualizado_em: agora }).eq("id", anterior.id);
  const [processamento, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status: "concluido", progresso: 100, mensagem: "Roteiro pronto para revisão.", concluido_em: agora, atualizado_em: agora }).eq("id", entrada.processamentoId),
    cliente.from("projetos").update({ status: "roteiro_pronto", atualizado_em: agora }).eq("id", entrada.projetoId)
  ]);
  if (processamento.error || projeto.error) throw new Error("ANALYSIS_COMPLETE_FAILED", { cause: processamento.error ?? projeto.error });
  return roteiro.id;
}

/** Marca falha ou cancelamento da análise sem afetar o vídeo original validado. */
export async function falharAnaliseInterna(cliente: ServerSupabaseClient, processamentoId: string, projetoId: string, codigo: string, cancelado = false): Promise<void> {
  const agora = new Date().toISOString();
  const status = cancelado ? "cancelado" : "erro";
  const [processamento, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status, codigo_erro: codigo, mensagem: cancelado ? "Análise cancelada." : "Não foi possível gerar o roteiro.", concluido_em: agora, atualizado_em: agora }).eq("id", processamentoId),
    cliente.from("projetos").update({ status, atualizado_em: agora }).eq("id", projetoId)
  ]);
  if (processamento.error || projeto.error) throw new Error("ANALYSIS_FAIL_FAILED", { cause: processamento.error ?? projeto.error });
}

/** Substitui a timeline editável, preserva IDs conhecidos e invalida somente narrações alteradas. */
export async function salvarTimeline(cliente: AuthenticatedSupabaseClient, roteiroId: string, usuarioId: string, blocos: BlocoTimeline[], atualizadoEm?: string): Promise<RoteiroDetalhado | null> {
  const { data: roteiro, error } = await cliente.from("roteiros").select("*").eq("id", roteiroId).maybeSingle();
  if (error) throw new Error("SCRIPT_GET_FAILED", { cause: error });
  if (!roteiro) return null;
  if (atualizadoEm && atualizadoEm !== roteiro.atualizado_em) throw new Error("SCRIPT_EDIT_CONFLICT");
  const ativo = await cliente.from("processamentos").select("id").eq("projeto_id", roteiro.projeto_id).is("concluido_em", null).not("status", "in", "(concluido,erro,cancelado,ajuste_necessario)").limit(1);
  if (ativo.error) throw new Error("SCRIPT_PROCESSING_GET_FAILED", { cause: ativo.error });
  if (ativo.data.length) throw new Error("SCRIPT_PROCESSING_ACTIVE");
  const { data: atuais, error: atuaisError } = await cliente.from("blocos").select("*").eq("roteiro_id", roteiroId);
  if (atuaisError) throw new Error("SCRIPT_BLOCKS_GET_FAILED", { cause: atuaisError });
  const idsRecebidos = new Set(blocos.flatMap((bloco) => bloco.id ? [bloco.id] : []));
  if (idsRecebidos.size !== blocos.filter((bloco) => bloco.id).length || [...idsRecebidos].some((id) => !atuais.some((bloco) => bloco.id === id))) throw new Error("SCRIPT_BLOCK_NOT_FOUND");
  const agora = new Date().toISOString();
  const alterados = atuais.filter((atual) => {
    const novo = blocos.find((bloco) => bloco.id === atual.id);
    return !novo || atual.inicio_ms !== novo.inicioMs || atual.fim_ms !== novo.fimMs || atual.narracao !== novo.narracao;
  }).map((bloco) => bloco.id);
  const removidos = atuais.filter((bloco) => !idsRecebidos.has(bloco.id)).map((bloco) => bloco.id);
  const antes = atuais.sort((a, b) => a.ordem - b.ordem).map((bloco) => ({ id: bloco.id, inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, acaoVisual: bloco.acao_visual, narracao: bloco.narracao, evidenciasFrame: bloco.evidencias_frame, confianca: bloco.confianca ?? 0 }));
  const evento = await cliente.from("roteiro_eventos").insert({ roteiro_id: roteiroId, usuario_id: usuarioId, tipo: "timeline_editada", dados: { antes, quantidadeBlocos: blocos.length, blocosAlterados: alterados } });
  if (evento.error) throw new Error("SCRIPT_HISTORY_SAVE_FAILED", { cause: evento.error });
  // Libera as ordens sem apagar blocos nem MP3s cacheados durante divisão/fusão.
  const deslocamento = Math.max(0, ...atuais.map((bloco) => bloco.ordem)) + blocos.length + 1;
  const criados: string[] = [];
  try {
  for (const [indice, atual] of atuais.entries()) {
    const reserva = await cliente.from("blocos").update({ ordem: deslocamento + indice }).eq("id", atual.id);
    if (reserva.error) throw new Error("SCRIPT_ORDER_RESERVE_FAILED", { cause: reserva.error });
  }
  for (const [ordem, bloco] of blocos.entries()) {
    const atual = atuais.find((item) => item.id === bloco.id);
    const id = bloco.id ?? crypto.randomUUID();
    if (!bloco.id) criados.push(id);
    const mudou = !atual || alterados.includes(atual.id) || atual.acao_visual !== bloco.acaoVisual;
    const valores = { ordem, inicio_ms: bloco.inicioMs, fim_ms: bloco.fimMs, acao_visual: bloco.acaoVisual, narracao: bloco.narracao, evidencias_frame: bloco.evidenciasFrame, confianca: bloco.confianca, status: "pronto", editado_por_usuario: true, atualizado_em: mudou ? agora : atual.atualizado_em };
    const resultado = bloco.id
      ? await cliente.from("blocos").update({ ...valores, versao: (atuais.find((item) => item.id === bloco.id)?.versao ?? 0) + 1 }).eq("id", bloco.id)
      : await cliente.from("blocos").insert({ id, roteiro_id: roteiroId, ...valores, criado_em: agora });
    if (resultado.error) throw new Error("SCRIPT_BLOCK_SAVE_FAILED", { cause: resultado.error });
  }
  if (removidos.length) {
    const remocao = await cliente.from("blocos").delete().in("id", removidos);
    if (remocao.error) throw new Error("SCRIPT_BLOCK_DELETE_FAILED", { cause: remocao.error });
  }
  const atualizacao = await cliente.from("roteiros").update({ edicoes_humanas: true, atualizado_em: agora }).eq("id", roteiroId);
  if (atualizacao.error) throw new Error("SCRIPT_UPDATE_FAILED", { cause: atualizacao.error });
  } catch (causa) {
    // Data API não oferece transação multirregistro; compensa e mantém snapshot persistido.
    if (criados.length) {
      const limpeza = await cliente.from("blocos").delete().in("id", criados);
      if (limpeza.error) throw new Error("SCRIPT_RESTORE_REQUIRED", { cause: causa });
    }
    const restantes = await cliente.from("blocos").select("id,ordem").eq("roteiro_id", roteiroId);
    if (restantes.error) throw new Error("SCRIPT_RESTORE_REQUIRED", { cause: causa });
    const reserva = Math.max(0, ...restantes.data.map((bloco) => bloco.ordem)) + atuais.length + 1;
    for (const [indice, bloco] of restantes.data.entries()) {
      const resultado = await cliente.from("blocos").update({ ordem: reserva + indice }).eq("id", bloco.id);
      if (resultado.error) throw new Error("SCRIPT_RESTORE_REQUIRED", { cause: causa });
    }
    for (const bloco of atuais) {
      const restauracao = await cliente.from("blocos").upsert(bloco);
      if (restauracao.error) throw new Error("SCRIPT_RESTORE_REQUIRED", { cause: causa });
    }
    throw new Error("SCRIPT_SAVE_FAILED", { cause: causa });
  }
  return obterRoteiroAtual(cliente, roteiro.projeto_id);
}
