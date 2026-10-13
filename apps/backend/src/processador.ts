import { UnrecoverableError } from "bullmq";
import { access, mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "./config/env";
import { createServerSupabaseClient } from "./integrations/supabase/server";
import { log } from "./lib/logger";
import { concluirValidacaoInterna, falharValidacaoInterna, iniciarValidacaoInterna, obterTrabalhoInterno } from "./repositories/estudio-repository";
import { atualizarAnaliseInterna, concluirAnaliseInterna, falharAnaliseInterna, obterAnaliseInterna } from "./repositories/roteiro-repository";
import { atualizarEstadoNarracao, concluirNarracao, criarProcessamentoNarracao, falharNarracao, obterTrabalhoNarracao, type ConfiguracaoNarracao, type TrabalhoNarracao } from "./repositories/narracao-repository";
import { ArmazenamentoLocal } from "./services/armazenamento-arquivos";
import { ArmazenamentoB2, b2Configurada, hashArquivo } from "./services/b2";
import { extrairQuadros } from "./services/extracao-quadros";
import type { TrabalhoProcessamento } from "./services/fila-processamentos";
import { inspecionarVideo } from "./services/ffprobe";
import { gerarRoteiroComIa, PROMPT_ROTEIRO_VERSAO, reduzirTextoNarracao } from "./services/openai-roteiro";
import { hashNarracao, ProvedorFishAudio } from "./services/fish-audio";
import { inspecionarAudio } from "./services/ffprobe";
import { montarWav, renderizarMp4 } from "./services/renderizar-narracao";
import { avaliarDuracoes } from "./services/sincronizacao-audio";
import { ajustarNarracao } from "./services/ajustar-narracao";
import { gerarLegendas } from "./services/legendas";

const env = getServerEnv();
if (!env.ok) throw new Error(`WORKER_CONFIGURATION_ERROR:${env.issues.join(",")}`);
const configuracao = env.data;

const cliente = createServerSupabaseClient(configuracao);
const armazenamento = new ArmazenamentoLocal(configuracao.START_BACK_STORAGE_ROOT);
const b2 = b2Configurada() ? new ArmazenamentoB2() : null;

async function obterCaminho(chave: string): Promise<string> {
  const caminho = armazenamento.caminhoAbsoluto(chave);
  if (b2 && !await existe(caminho)) await b2.baixar(chave, caminho);
  return caminho;
}

/** Valida um vídeo usando apenas IDs reidratados do banco e caminhos internos. */
type Trabalho = { name: string; data: TrabalhoProcessamento };
type AgendarNarracao = (processamentoId: string) => Promise<string>;

async function processarVideo(job: Trabalho): Promise<void> {
  const trabalho = await obterTrabalhoInterno(cliente, job.data.processamentoId);
  if (!trabalho) throw new UnrecoverableError("PROCESSING_NOT_FOUND");
  if (trabalho.processamento.cancelamento_solicitado_em) {
    await falharValidacaoInterna(cliente, trabalho, "CANCELLED", true);
    return;
  }
  await iniciarValidacaoInterna(cliente, trabalho);
  const metadados = await inspecionarVideo(await obterCaminho(trabalho.arquivo.chave_armazenamento));
  if (metadados.duracaoMs > configuracao.START_BACK_MAX_VIDEO_DURATION_MS) {
    await falharValidacaoInterna(cliente, trabalho, "VIDEO_DURATION_EXCEEDED");
    throw new UnrecoverableError("VIDEO_DURATION_EXCEEDED");
  }
  const atualizado = await obterTrabalhoInterno(cliente, job.data.processamentoId);
  if (atualizado?.processamento.cancelamento_solicitado_em) {
    await falharValidacaoInterna(cliente, trabalho, "CANCELLED", true);
    return;
  }
  await concluirValidacaoInterna(cliente, trabalho, metadados);
  log("info", "Vídeo validado pelo worker.", { event: "worker.video_validated", projetoId: trabalho.processamento.projeto_id, processamentoId: trabalho.processamento.id });
}

/** Extrai evidências visuais, solicita roteiro estruturado e persiste uma nova versão. */
async function processarAnalise(job: Trabalho, agendarNarracao: AgendarNarracao): Promise<void> {
  const trabalho = await obterAnaliseInterna(cliente, job.data.processamentoId);
  if (!trabalho) throw new UnrecoverableError("ANALYSIS_NOT_FOUND");
  if (!configuracao.OPENAI_API_KEY) throw new UnrecoverableError("OPENAI_NOT_CONFIGURED");
  if (!trabalho.video.duracao_ms) throw new UnrecoverableError("VIDEO_METADATA_MISSING");
  if (trabalho.processamento.cancelamento_solicitado_em) {
    await falharAnaliseInterna(cliente, trabalho.processamento.id, trabalho.processamento.projeto_id, "CANCELLED", true);
    return;
  }
  await atualizarAnaliseInterna(cliente, trabalho.processamento.id, 10, "Extraindo quadros do vídeo.");
  const extraidos = await extrairQuadros(await obterCaminho(trabalho.arquivo.chave_armazenamento), configuracao.START_BACK_MAX_ANALYSIS_FRAMES);
  try {
    await atualizarAnaliseInterna(cliente, trabalho.processamento.id, 35, "Analisando cenas com IA.");
    const opcoes = trabalho.processamento.configuracao as { modelo?: "gpt-6.1-sol" | "gpt-6-astra"; tom?: "natural" | "conversado"; narracao?: Omit<ConfiguracaoNarracao, "roteiroId"> };
    const modelo = opcoes.modelo ?? configuracao.START_BACK_OPENAI_MODEL;
    const resultado = await gerarRoteiroComIa({ apiKey: configuracao.OPENAI_API_KEY, modelo, tom: opcoes.tom, duracaoVideoMs: trabalho.video.duracao_ms, quadros: extraidos.quadros });
    const atualizado = await obterAnaliseInterna(cliente, job.data.processamentoId);
    if (atualizado?.processamento.cancelamento_solicitado_em) {
      await falharAnaliseInterna(cliente, trabalho.processamento.id, trabalho.processamento.projeto_id, "CANCELLED", true);
      return;
    }
    await atualizarAnaliseInterna(cliente, trabalho.processamento.id, 85, "Validando tempos do roteiro.");
    const roteiroId = await concluirAnaliseInterna(cliente, {
      processamentoId: trabalho.processamento.id,
      projetoId: trabalho.processamento.projeto_id,
      videoId: trabalho.video.id,
      modelo,
      promptVersao: PROMPT_ROTEIRO_VERSAO,
      uso: { ...resultado.uso, respostaId: resultado.respostaId, topicos: resultado.topicos },
      blocos: resultado.blocos
    });
    if (opcoes.narracao) {
      const processamento = await criarProcessamentoNarracao(cliente, { roteiroId, ...opcoes.narracao });
      if (!processamento) throw new Error("AUTOMATIC_NARRATION_CREATE_FAILED");
      const jobId = await agendarNarracao(processamento.id);
      const vinculo = await cliente.from("processamentos").update({ job_id: jobId, atualizado_em: new Date().toISOString() }).eq("id", processamento.id);
      if (vinculo.error) throw new Error("AUTOMATIC_NARRATION_JOB_LINK_FAILED", { cause: vinculo.error });
    }
    log("info", "Roteiro gerado pelo worker.", { event: "worker.script_generated", projetoId: trabalho.processamento.projeto_id, processamentoId: trabalho.processamento.id, roteiroId });
  } finally {
    await extraidos.limpar();
  }
}

/** Gera clips cacheáveis, mede todos e monta o produto apenas quando a timeline é válida. */
async function processarNarracao(job: Trabalho): Promise<void> {
  const trabalho = await obterTrabalhoNarracao(cliente, job.data.processamentoId);
  if (!trabalho) throw new UnrecoverableError("NARRATION_NOT_FOUND");
  const controller = new AbortController();
  const verificar = async () => {
    const estado = await cliente.from("processamentos").select("cancelamento_solicitado_em").eq("id", trabalho.processamento.id).single();
    if (estado.error) throw new Error("CANCELLATION_CHECK_FAILED");
    if (estado.data.cancelamento_solicitado_em) controller.abort(new Error("CANCELLED"));
  };
  await verificar();
  const timer = setInterval(() => { void verificar().catch((error: unknown) => controller.abort(error)); }, 1500);
  try {
    await gerarNarracao(trabalho, controller.signal);
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof Error && controller.signal.reason.message === "CANCELLED") {
      await falharNarracao(cliente, trabalho, "CANCELLED", true);
      return;
    }
    throw error;
  } finally { clearInterval(timer); }
}

async function gerarNarracao(trabalho: TrabalhoNarracao, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (!configuracao.FISH_API_KEY) throw new UnrecoverableError("FISH_NOT_CONFIGURED");
  if (!trabalho.video.duracao_ms) throw new UnrecoverableError("VIDEO_METADATA_MISSING");
  const provedor = new ProvedorFishAudio(configuracao.FISH_API_KEY);
  await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "gerando_voz", 5, "Gerando e reutilizando clips de voz.");
  let completos = 0;
  const gerarClip = async (bloco: TrabalhoNarracao["blocos"][number], tentativa = 0) => {
    signal.throwIfAborted();
    const hash = hashNarracao(bloco.narracao, trabalho.voz.referencia_externa, { modelo: trabalho.configuracao.modelo });
    const chave = path.posix.join("projetos", trabalho.processamento.projeto_id, "roteiros", trabalho.configuracao.roteiroId, "narracoes", `${hash}.mp3`);
    const caminho = armazenamento.caminhoAbsoluto(chave);
    const forcar = tentativa === 0 && (trabalho.configuracao.forcarTodos || trabalho.configuracao.forcarBlocoId === bloco.id);
    if (b2 && !forcar && !await existe(caminho) && await b2.metadados(chave)) await b2.baixar(chave, caminho);
    const reutilizado = !forcar && await existe(caminho);
    if (!reutilizado) await provedor.gerar({ texto: bloco.narracao, referenceId: trabalho.voz.referencia_externa, destino: caminho, configuracao: { modelo: trabalho.configuracao.modelo }, signal });
    const audio = await inspecionarAudio(caminho);
    const arquivoId = await garantirArquivo(trabalho, chave, "audio", "audio/mpeg", (await stat(caminho)).size, hash);
    const agora = new Date().toISOString();
    const { data: existente, error: erroExistente } = await cliente.from("narracoes").select("id,tentativas").eq("bloco_id", bloco.id).eq("hash_cache", hash).maybeSingle();
    if (erroExistente) throw new Error("NARRATION_CLIP_GET_FAILED", { cause: erroExistente });
    const valores = { bloco_id: bloco.id, voz_id: trabalho.voz.id, arquivo_id: arquivoId, hash_cache: hash, duracao_ms: audio.duracaoMs, status: "validando_duracoes", tentativas: (existente?.tentativas ?? 0) + (reutilizado ? 0 : 1), modelo: trabalho.configuracao.modelo, configuracao: { texto: bloco.narracao, reescritas: tentativa }, atualizado_em: agora };
    const gravacao = existente
      ? await cliente.from("narracoes").update(valores).eq("id", existente.id)
      : await cliente.from("narracoes").insert({ ...valores, criado_em: agora });
    if (gravacao.error) throw new Error("NARRATION_CLIP_SAVE_FAILED", { cause: gravacao.error });
    return { bloco, caminho, hash, texto: bloco.narracao, duracaoMs: audio.duracaoMs, duracaoAudioMs: audio.duracaoMs };
  };
  const clips = await mapearComLimite(trabalho.blocos, configuracao.START_BACK_FISH_CONCURRENCY, async (bloco) => {
    const clip = await gerarClip(bloco);
    completos++;
    await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "gerando_voz", 5 + Math.floor(55 * completos / trabalho.blocos.length), `Voz: ${completos}/${trabalho.blocos.length} cenas medidas.`);
    return clip;
  });
  await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "validando_duracoes", 65, "Validando a duração de todos os blocos.");
  if (trabalho.configuracao.ajustarTextoAutomaticamente) {
    if (!configuracao.OPENAI_API_KEY) throw new UnrecoverableError("OPENAI_NOT_CONFIGURED");
    for (const [i, clip] of clips.entries()) {
      clips[i] = await ajustarNarracao(clip, clip.bloco.fim_ms - clip.bloco.inicio_ms,
        (texto, duracaoAudioMs) => reduzirTextoNarracao({ apiKey: configuracao.OPENAI_API_KEY!, modelo: configuracao.START_BACK_OPENAI_MODEL, texto, acaoVisual: clip.bloco.acao_visual, textoAnterior: clips[i - 1]?.texto, textoSeguinte: clips[i + 1]?.texto, janelaMs: clip.bloco.fim_ms - clip.bloco.inicio_ms, duracaoAudioMs, signal }),
        async (texto, tentativa) => {
          const novo = await gerarClip({ ...clip.bloco, narracao: texto }, tentativa);
          const atualizacao = await cliente.from("blocos").update({ narracao: texto, versao: clip.bloco.versao + tentativa, atualizado_em: new Date().toISOString() }).eq("id", clip.bloco.id);
          if (atualizacao.error) throw new Error("BLOCK_REWRITE_SAVE_FAILED", { cause: atualizacao.error });
          const evento = await cliente.from("roteiro_eventos").insert({ roteiro_id: trabalho.configuracao.roteiroId, tipo: "texto_ajustado_automaticamente", dados: { blocoId: clip.bloco.id, anterior: clip.texto, texto, tentativa } });
          if (evento.error) throw new Error("REWRITE_EVENT_SAVE_FAILED", { cause: evento.error });
          return novo;
        });
    }
  }
  const medicoes = avaliarDuracoes(clips.map(({ bloco, duracaoAudioMs }) => ({ blocoId: bloco.id, inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, duracaoAudioMs })));
  await Promise.all(medicoes.map(async (medicao) => {
    const { error } = await cliente.from("narracoes").update({ status: medicao.status, taxa_aceleracao: medicao.taxaAceleracao, atualizado_em: new Date().toISOString() }).eq("bloco_id", medicao.blocoId).eq("hash_cache", clips.find((clip) => clip.bloco.id === medicao.blocoId)!.hash);
    if (error) throw new Error("NARRATION_MEASUREMENT_SAVE_FAILED", { cause: error });
  }));
  const longos = medicoes.filter((medicao) => medicao.status === "ajuste_necessario");
  if (longos.length) {
    await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "ajuste_necessario", 70, `${longos.length} bloco(s) precisam de texto menor.`);
    return;
  }
  await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "renderizando", 75, "Montando WAV e MP4 sincronizados.");
  const base = path.posix.join("projetos", trabalho.processamento.projeto_id, "roteiros", trabalho.configuracao.roteiroId, "render");
  const chaveWav = path.posix.join(base, `${trabalho.processamento.id}.wav`);
  const caminhoWav = armazenamento.caminhoAbsoluto(chaveWav);
  await montarWav(clips.map((clip) => ({ caminho: clip.caminho, inicioMs: clip.bloco.inicio_ms, taxaAceleracao: medicoes.find((item) => item.blocoId === clip.bloco.id)?.taxaAceleracao ?? 1 })), trabalho.video.duracao_ms, caminhoWav, signal);
  const chaveMp4 = path.posix.join(base, `${trabalho.processamento.id}.mp4`);
  const caminhoMp4 = armazenamento.caminhoAbsoluto(chaveMp4);
  await renderizarMp4(await obterCaminho(trabalho.arquivoVideo.chave_armazenamento), caminhoWav, caminhoMp4, trabalho.configuracao.modoAudio, signal);
  await atualizarEstadoNarracao(cliente, trabalho.processamento.id, "verificando_resultado", 95, "Validando o MP4 final.");
  await garantirArquivo(trabalho, chaveMp4, "video_final", "video/mp4", (await stat(caminhoMp4)).size, null);
  await garantirArquivo(trabalho, chaveWav, "audio", "audio/wav", (await stat(caminhoWav)).size, null);
  if (trabalho.configuracao.gerarLegendas) {
    for (const formato of ["srt", "vtt"] as const) {
      const chave = path.posix.join(base, `${trabalho.processamento.id}.${formato}`);
      const destino = armazenamento.caminhoAbsoluto(chave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(`${destino}.tmp`, gerarLegendas(clips.map((clip) => ({ inicioMs: clip.bloco.inicio_ms, fimMs: clip.bloco.fim_ms, texto: clip.texto })), formato));
      await rename(`${destino}.tmp`, destino);
      await garantirArquivo(trabalho, chave, "legenda", formato === "srt" ? "application/x-subrip" : "text/vtt", (await stat(destino)).size, null);
    }
  }
  await concluirNarracao(cliente, trabalho, "Narração e MP4 concluídos.");
}

async function garantirArquivo(trabalho: TrabalhoNarracao, chave: string, tipo: string, mimeType: string, tamanho: number, hash: string | null): Promise<string> {
  if (b2) {
    const caminho = armazenamento.caminhoAbsoluto(chave);
    await b2.enviarArquivo(chave, caminho, mimeType, await hashArquivo(caminho));
  }
  const { data: existente, error } = await cliente.from("arquivos").select("id").eq("chave_armazenamento", chave).maybeSingle();
  if (error) throw new Error("NARRATION_FILE_GET_FAILED", { cause: error });
  if (existente) return existente.id;
  const id = crypto.randomUUID();
  const { error: insertError } = await cliente.from("arquivos").insert({ id, projeto_id: trabalho.processamento.projeto_id, tipo, chave_armazenamento: chave, mime_type: mimeType, tamanho_bytes: tamanho, hash_sha256: hash, criado_em: new Date().toISOString() });
  if (insertError) throw new Error("NARRATION_FILE_SAVE_FAILED", { cause: insertError });
  return id;
}

async function mapearComLimite<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const indice = proximo++;
      resultados[indice] = await fn(itens[indice]!);
    }
  }));
  return resultados;
}

async function existe(caminho: string): Promise<boolean> {
  try { await access(caminho); return true; } catch { return false; }
}

/** Direciona cada job persistido ao processador correspondente. */
export async function processar(job: Trabalho, agendarNarracao: AgendarNarracao): Promise<void> {
  if (job.name === "analisar-video") return processarAnalise(job, agendarNarracao);
  if (job.name === "gerar-narracao") return processarNarracao(job);
  return processarVideo(job);
}

/** Persiste o erro somente depois que retries acabaram ou a falha foi definitiva. */
export async function registrarFalhaFinal(processamentoId: string, nomeJob: string): Promise<void> {
  const { data: estado, error } = await cliente.from("processamentos").select("status").eq("id", processamentoId).maybeSingle();
  if (error) throw new Error("PROCESSING_STATE_GET_FAILED", { cause: error });
  if (!estado || ["concluido", "cancelado", "ajuste_necessario"].includes(estado.status)) return;
  if (nomeJob === "analisar-video") {
    const analise = await obterAnaliseInterna(cliente, processamentoId);
    if (analise && analise.processamento.status !== "cancelado") await falharAnaliseInterna(cliente, processamentoId, analise.processamento.projeto_id, "ANALYSIS_FAILED");
    return;
  }
  if (nomeJob === "gerar-narracao") {
    const narracao = await obterTrabalhoNarracao(cliente, processamentoId);
    if (narracao && narracao.processamento.status !== "cancelado") await falharNarracao(cliente, narracao, "NARRATION_FAILED");
    return;
  }
  const trabalho = await obterTrabalhoInterno(cliente, processamentoId);
  if (trabalho && trabalho.processamento.status !== "cancelado") await falharValidacaoInterna(cliente, trabalho, "VIDEO_VALIDATION_FAILED");
}

