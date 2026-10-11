import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";
import type { Database } from "@/integrations/supabase/database.types";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";
import { arquivoDoProjeto } from "@/services/vinculo-arquivo";

type Projeto = Database["tutoriais"]["Tables"]["projetos"]["Row"];
type Video = Database["tutoriais"]["Tables"]["videos"]["Row"];
type Processamento = Database["tutoriais"]["Tables"]["processamentos"]["Row"];
type Arquivo = Database["tutoriais"]["Tables"]["arquivos"]["Row"];

export interface NovoVideo {
  projetoId: string;
  videoId: string;
  arquivoId: string;
  processamentoId: string;
  nomeOriginal: string;
  mimeType: string;
  tamanhoBytes: number;
  chaveArmazenamento: string;
  hashSha256: string;
}

export interface ProjetoDetalhado extends Projeto {
  videos: Video[];
  processamentos: Processamento[];
  thumbnail: Arquivo | null;
}

/** Lista somente projetos liberados pelas policies RLS do chamador. */
export async function listarProjetos(cliente: AuthenticatedSupabaseClient): Promise<ProjetoDetalhado[]> {
  const { data: projetos, error } = await cliente.from("projetos").select("*").order("criado_em", { ascending: false });
  if (error) throw new Error("PROJECT_LIST_FAILED", { cause: error });
  if (projetos.length === 0) return [];

  const ids = projetos.map((projeto) => projeto.id);
  const [{ data: videos, error: videoError }, { data: processamentos, error: processamentoError }, { data: thumbnails, error: thumbnailError }] = await Promise.all([
    cliente.from("videos").select("*").in("projeto_id", ids).order("criado_em", { ascending: false }),
    cliente.from("processamentos").select("*").in("projeto_id", ids).order("criado_em", { ascending: false }),
    cliente.from("arquivos").select("*").in("projeto_id", ids).eq("tipo", "thumbnail").order("criado_em", { ascending: false })
  ]);
  if (videoError || processamentoError || thumbnailError) throw new Error("PROJECT_RELATIONS_FAILED", { cause: videoError ?? processamentoError ?? thumbnailError });
  return projetos.map((projeto) => ({
    ...projeto,
    videos: videos.filter((video) => video.projeto_id === projeto.id),
    processamentos: processamentos.filter((processamento) => processamento.projeto_id === projeto.id),
    thumbnail: thumbnails.find((thumbnail) => thumbnail.projeto_id === projeto.id) ?? null
  }));
}

/** Consulta um projeto autorizado e seus estados de vídeo/processamento. */
export async function obterProjeto(cliente: AuthenticatedSupabaseClient, projetoId: string): Promise<ProjetoDetalhado | null> {
  const { data: projeto, error } = await cliente.from("projetos").select("*").eq("id", projetoId).maybeSingle();
  if (error) throw new Error("PROJECT_GET_FAILED", { cause: error });
  if (!projeto) return null;
  const [{ data: videos, error: videoError }, { data: processamentos, error: processamentoError }, { data: thumbnails, error: thumbnailError }] = await Promise.all([
    cliente.from("videos").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: false }),
    cliente.from("processamentos").select("*").eq("projeto_id", projetoId).order("criado_em", { ascending: false }),
    cliente.from("arquivos").select("*").eq("projeto_id", projetoId).eq("tipo", "thumbnail").order("criado_em", { ascending: false })
  ]);
  if (videoError || processamentoError || thumbnailError) throw new Error("PROJECT_RELATIONS_FAILED", { cause: videoError ?? processamentoError ?? thumbnailError });
  return { ...projeto, videos, processamentos, thumbnail: thumbnails[0] ?? null };
}

/** Troca a capa mantendo a anterior até o novo registro estar persistido. */
export async function registrarThumbnail(cliente: AuthenticatedSupabaseClient, projetoId: string, arquivo: Omit<Arquivo, "projeto_id" | "tipo" | "excluir_apos">): Promise<{ arquivo: Arquivo; chavesAnteriores: string[] } | null> {
  const { data: projeto, error: projetoError } = await cliente.from("projetos").select("id").eq("id", projetoId).maybeSingle();
  if (projetoError) throw new Error("PROJECT_GET_FAILED", { cause: projetoError });
  if (!projeto) return null;
  const { data: anteriores, error: anterioresError } = await cliente.from("arquivos").select("*").eq("projeto_id", projetoId).eq("tipo", "thumbnail");
  if (anterioresError) throw new Error("THUMBNAIL_LIST_FAILED", { cause: anterioresError });
  const { data: criada, error: criarError } = await cliente.from("arquivos").insert({ ...arquivo, projeto_id: projetoId, tipo: "thumbnail" }).select().single();
  if (criarError) throw new Error("THUMBNAIL_CREATE_FAILED", { cause: criarError });
  if (anteriores.length) {
    const { error: excluirError } = await cliente.from("arquivos").delete().in("id", anteriores.map((item) => item.id));
    if (excluirError) {
      await cliente.from("arquivos").delete().eq("id", criada.id);
      throw new Error("THUMBNAIL_REPLACE_FAILED", { cause: excluirError });
    }
  }
  return { arquivo: criada, chavesAnteriores: anteriores.map((item) => item.chave_armazenamento) };
}

/** Cria um projeto pessoal vinculado ao usuário autenticado. */
export async function criarProjeto(cliente: AuthenticatedSupabaseClient, usuarioId: string, titulo: string, empresaId: string, areaId: string): Promise<Projeto> {
  const agora = new Date().toISOString();
  const [{ data: empresa, error: empresaError }, { data: area, error: areaError }] = await Promise.all([
    cliente.from("empresas").select("id,nome").eq("id", empresaId).maybeSingle(),
    cliente.from("areas").select("id,empresa_id,nome").eq("id", areaId).maybeSingle()
  ]);
  if (empresaError || areaError || !empresa || !area || area.empresa_id !== empresa.id) throw new Error("PROJECT_ORGANIZATION_INVALID");
  const { data, error } = await cliente.from("projetos").insert({ titulo, empresa: empresa.nome, setor: area.nome, empresa_id: empresa.id, area_id: area.id, proprietario_id: usuarioId, criado_em: agora, atualizado_em: agora }).select().single();
  if (error) throw new Error("PROJECT_CREATE_FAILED", { cause: error });
  return data;
}

/** Edita somente metadados permitidos e resolve a organização por IDs cadastrados. */
export async function atualizarProjeto(cliente: AuthenticatedSupabaseClient, projetoId: string, entrada: { titulo?: string; descricao?: string; tags?: string[]; areaId?: string }): Promise<Projeto | null> {
  const atualizacao: Database["tutoriais"]["Tables"]["projetos"]["Update"] = { atualizado_em: new Date().toISOString() };
  if (entrada.titulo !== undefined) atualizacao.titulo = entrada.titulo;
  if (entrada.descricao !== undefined) atualizacao.descricao = entrada.descricao;
  if (entrada.tags !== undefined) atualizacao.tags = entrada.tags;
  if (entrada.areaId) {
    const { data: area, error: areaError } = await cliente.from("areas").select("id,empresa_id,nome").eq("id", entrada.areaId).maybeSingle();
    if (areaError || !area) throw new Error("PROJECT_ORGANIZATION_INVALID", { cause: areaError });
    const { data: empresa, error: empresaError } = await cliente.from("empresas").select("id,nome").eq("id", area.empresa_id).maybeSingle();
    if (empresaError || !empresa) throw new Error("PROJECT_ORGANIZATION_INVALID", { cause: empresaError });
    Object.assign(atualizacao, { empresa: empresa.nome, setor: area.nome, empresa_id: empresa.id, area_id: area.id });
  }
  const { data, error } = await cliente.from("projetos").update(atualizacao).eq("id", projetoId).select().maybeSingle();
  if (error) throw new Error("PROJECT_UPDATE_FAILED", { cause: error });
  return data;
}

/** Exclui o projeto autorizado e devolve chaves internas para limpeza posterior. */
export async function excluirProjeto(cliente: ServerSupabaseClient, projetoId: string): Promise<string[] | null> {
  const { data: arquivos, error: arquivoError } = await cliente.from("arquivos").select("projeto_id,chave_armazenamento,tipo,mime_type").eq("projeto_id", projetoId);
  if (arquivoError) throw new Error("PROJECT_FILES_FAILED", { cause: arquivoError });
  const { data, error } = await cliente.from("projetos").delete().eq("id", projetoId).select("id").maybeSingle();
  if (error) throw new Error("PROJECT_DELETE_FAILED", { cause: error });
  return data ? arquivos.filter((arquivo) => arquivoDoProjeto(projetoId, arquivo)).map((arquivo) => arquivo.chave_armazenamento) : null;
}

/** Persiste arquivo, vídeo e processamento compensando inserções parciais em caso de falha. */
export async function registrarVideo(cliente: AuthenticatedSupabaseClient, novo: NovoVideo): Promise<Processamento> {
  const agora = new Date().toISOString();
  const { error: arquivoError } = await cliente.from("arquivos").insert({
    id: novo.arquivoId, projeto_id: novo.projetoId, tipo: "video_original", chave_armazenamento: novo.chaveArmazenamento,
    mime_type: novo.mimeType, tamanho_bytes: novo.tamanhoBytes, hash_sha256: novo.hashSha256, criado_em: agora
  });
  if (arquivoError) throw new Error("FILE_CREATE_FAILED", { cause: arquivoError });

  const { error: videoError } = await cliente.from("videos").insert({
    id: novo.videoId, projeto_id: novo.projetoId, arquivo_original_id: novo.arquivoId, nome_original: novo.nomeOriginal,
    mime_type: novo.mimeType, tamanho_bytes: novo.tamanhoBytes, status: "recebido", criado_em: agora, atualizado_em: agora
  });
  if (videoError) {
    await cliente.from("arquivos").delete().eq("id", novo.arquivoId);
    throw new Error("VIDEO_CREATE_FAILED", { cause: videoError });
  }

  const { data, error: processamentoError } = await cliente.from("processamentos").insert({
    id: novo.processamentoId, projeto_id: novo.projetoId, video_id: novo.videoId, tipo: "validar_video",
    status: "recebido", progresso: 0, mensagem: "Upload recebido.", criado_em: agora, atualizado_em: agora
  }).select().single();
  if (processamentoError) {
    await cliente.from("videos").delete().eq("id", novo.videoId);
    await cliente.from("arquivos").delete().eq("id", novo.arquivoId);
    throw new Error("PROCESSING_CREATE_FAILED", { cause: processamentoError });
  }
  return data;
}

/** Registra o identificador persistente do BullMQ após o enfileiramento. */
export async function vincularJob(cliente: AuthenticatedSupabaseClient, processamentoId: string, jobId: string): Promise<void> {
  const { error } = await cliente.from("processamentos").update({ job_id: jobId, atualizado_em: new Date().toISOString() }).eq("id", processamentoId);
  if (error) throw new Error("PROCESSING_JOB_LINK_FAILED", { cause: error });
}

/** Obtém o arquivo de um vídeo somente se o JWT tiver acesso ao projeto. */
export async function obterArquivoDoVideo(cliente: AuthenticatedSupabaseClient, videoId: string): Promise<{ video: Video; arquivo: Arquivo } | null> {
  const { data: video, error: videoError } = await cliente.from("videos").select("*").eq("id", videoId).maybeSingle();
  if (videoError) throw new Error("VIDEO_GET_FAILED", { cause: videoError });
  if (!video) return null;
  const { data: arquivo, error: arquivoError } = await cliente.from("arquivos").select("*").eq("id", video.arquivo_original_id).maybeSingle();
  if (arquivoError) throw new Error("FILE_GET_FAILED", { cause: arquivoError });
  return arquivo && arquivoDoProjeto(video.projeto_id, arquivo) ? { video, arquivo } : null;
}

/** Resolve um arquivo após a validação de um token assinado pelo servidor. */
export async function obterArquivoInterno(cliente: ServerSupabaseClient, videoId: string): Promise<{ video: Video; arquivo: Arquivo } | null> {
  const { data: video, error: videoError } = await cliente.from("videos").select("*").eq("id", videoId).maybeSingle();
  if (videoError) throw new Error("INTERNAL_VIDEO_GET_FAILED", { cause: videoError });
  if (!video) return null;
  const { data: arquivo, error: arquivoError } = await cliente.from("arquivos").select("*").eq("id", video.arquivo_original_id).maybeSingle();
  if (arquivoError) throw new Error("INTERNAL_FILE_GET_FAILED", { cause: arquivoError });
  return arquivo && arquivoDoProjeto(video.projeto_id, arquivo) ? { video, arquivo } : null;
}

/** Autoriza um artefato pelo RLS do projeto sem expor sua chave interna. */
export async function obterArquivoGerado(cliente: AuthenticatedSupabaseClient, arquivoId: string): Promise<Arquivo | null> {
  const { data, error } = await cliente.from("arquivos").select("*").eq("id", arquivoId).in("tipo", ["audio", "video_final", "legenda", "thumbnail"]).maybeSingle();
  if (error) throw new Error("GENERATED_FILE_GET_FAILED", { cause: error });
  return data && arquivoDoProjeto(data.projeto_id, data) ? data : null;
}

/** Resolve internamente um artefato após a validação do token assinado. */
export async function obterArquivoGeradoInterno(cliente: ServerSupabaseClient, arquivoId: string): Promise<Arquivo | null> {
  const { data, error } = await cliente.from("arquivos").select("*").eq("id", arquivoId).in("tipo", ["audio", "video_final", "legenda", "thumbnail"]).maybeSingle();
  if (error) throw new Error("INTERNAL_GENERATED_FILE_GET_FAILED", { cause: error });
  return data && arquivoDoProjeto(data.projeto_id, data) ? data : null;
}

/** Consulta um processamento sujeito ao mesmo isolamento RLS do projeto. */
export async function obterProcessamento(cliente: AuthenticatedSupabaseClient, processamentoId: string): Promise<Processamento | null> {
  const { data, error } = await cliente.from("processamentos").select("*").eq("id", processamentoId).maybeSingle();
  if (error) throw new Error("PROCESSING_GET_FAILED", { cause: error });
  return data;
}

/** Solicita cancelamento persistente para que o worker interrompa com segurança. */
export async function solicitarCancelamento(cliente: AuthenticatedSupabaseClient, processamentoId: string): Promise<Processamento | null> {
  const agora = new Date().toISOString();
  const { data, error } = await cliente.from("processamentos").update({ cancelamento_solicitado_em: agora, atualizado_em: agora }).eq("id", processamentoId).select().maybeSingle();
  if (error) throw new Error("PROCESSING_CANCEL_FAILED", { cause: error });
  return data;
}

/** Busca internamente o job e deriva caminho/projeto apenas de registros persistidos. */
export async function obterTrabalhoInterno(cliente: ServerSupabaseClient, processamentoId: string): Promise<{ processamento: Processamento; video: Video; arquivo: Arquivo } | null> {
  const { data: processamento, error } = await cliente.from("processamentos").select("*").eq("id", processamentoId).maybeSingle();
  if (error) throw new Error("INTERNAL_PROCESSING_GET_FAILED", { cause: error });
  if (!processamento?.video_id) return null;
  const { data: video, error: videoError } = await cliente.from("videos").select("*").eq("id", processamento.video_id).maybeSingle();
  if (videoError) throw new Error("INTERNAL_VIDEO_GET_FAILED", { cause: videoError });
  if (!video) return null;
  const { data: arquivo, error: arquivoError } = await cliente.from("arquivos").select("*").eq("id", video.arquivo_original_id).maybeSingle();
  if (arquivoError) throw new Error("INTERNAL_FILE_GET_FAILED", { cause: arquivoError });
  return arquivo && video.projeto_id === processamento.projeto_id && arquivoDoProjeto(processamento.projeto_id, arquivo) ? { processamento, video, arquivo } : null;
}

/** Atualiza o estado interno do processamento e do vídeo com valores controlados pelo worker. */
export async function iniciarValidacaoInterna(cliente: ServerSupabaseClient, trabalho: { processamento: Processamento; video: Video }): Promise<void> {
  const agora = new Date().toISOString();
  const [processamento, video, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status: "processando_video", progresso: 20, mensagem: "Validando o vídeo.", iniciado_em: agora, atualizado_em: agora }).eq("id", trabalho.processamento.id),
    cliente.from("videos").update({ status: "processando_video", atualizado_em: agora }).eq("id", trabalho.video.id),
    cliente.from("projetos").update({ status: "processando_video", atualizado_em: agora }).eq("id", trabalho.processamento.projeto_id)
  ]);
  if (processamento.error || video.error || projeto.error) throw new Error("INTERNAL_PROCESSING_START_FAILED", { cause: processamento.error ?? video.error ?? projeto.error });
}

/** Persiste metadados aprovados pelo FFprobe e conclui o job. */
export async function concluirValidacaoInterna(cliente: ServerSupabaseClient, trabalho: { processamento: Processamento; video: Video }, metadados: { duracaoMs: number; largura: number; altura: number; fps: number; possuiAudio: boolean }): Promise<void> {
  const agora = new Date().toISOString();
  const [processamento, video, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status: "concluido", progresso: 100, mensagem: "Vídeo validado.", concluido_em: agora, atualizado_em: agora }).eq("id", trabalho.processamento.id),
    cliente.from("videos").update({ status: "pronto", duracao_ms: metadados.duracaoMs, largura: metadados.largura, altura: metadados.altura, fps: metadados.fps, possui_audio: metadados.possuiAudio, atualizado_em: agora }).eq("id", trabalho.video.id),
    cliente.from("projetos").update({ status: "recebido", atualizado_em: agora }).eq("id", trabalho.processamento.projeto_id)
  ]);
  if (processamento.error || video.error || projeto.error) throw new Error("INTERNAL_PROCESSING_COMPLETE_FAILED", { cause: processamento.error ?? video.error ?? projeto.error });
}

/** Marca cancelamento ou erro sem apagar a evidência do upload. */
export async function falharValidacaoInterna(cliente: ServerSupabaseClient, trabalho: { processamento: Processamento; video: Video }, codigo: string, cancelado = false): Promise<void> {
  const agora = new Date().toISOString();
  const status = cancelado ? "cancelado" : "erro";
  const [processamento, video, projeto] = await Promise.all([
    cliente.from("processamentos").update({ status, codigo_erro: codigo, mensagem: cancelado ? "Processamento cancelado." : "Não foi possível validar o vídeo.", concluido_em: agora, atualizado_em: agora }).eq("id", trabalho.processamento.id),
    cliente.from("videos").update({ status, codigo_erro: codigo, atualizado_em: agora }).eq("id", trabalho.video.id),
    cliente.from("projetos").update({ status, atualizado_em: agora }).eq("id", trabalho.processamento.projeto_id)
  ]);
  if (processamento.error || video.error || projeto.error) throw new Error("INTERNAL_PROCESSING_FAIL_FAILED", { cause: processamento.error ?? video.error ?? projeto.error });
}
