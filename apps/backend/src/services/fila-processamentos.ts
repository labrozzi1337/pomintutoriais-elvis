import { Queue, type JobsOptions } from "bullmq";
import type { ServerEnv } from "@/config/env";

export const NOME_FILA_PROCESSAMENTOS = "estudio-processamentos";

export interface TrabalhoValidarVideo {
  processamentoId: string;
}

export interface TrabalhoAnalisarVideo extends TrabalhoValidarVideo {
  tipo: "analisar_video";
}

export interface TrabalhoGerarNarracao extends TrabalhoValidarVideo {
  tipo: "gerar_narracao";
}

export type TrabalhoProcessamento = TrabalhoValidarVideo | TrabalhoAnalisarVideo | TrabalhoGerarNarracao;

let fila: Queue<TrabalhoProcessamento> | undefined;

/** Define retry limitado e retenção da evidência do job para idempotência. */
export function opcoesTrabalhoVideo(processamentoId: string): JobsOptions {
  return {
    jobId: `validar-video-${processamentoId}`,
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { age: 86_400, count: 1_000 },
    removeOnFail: { age: 604_800, count: 5_000 }
  };
}

/** Enfileira a validação sem carregar credenciais ou caminhos no Redis. */
export async function enfileirarValidacaoVideo(env: ServerEnv, processamentoId: string): Promise<string> {
  fila ??= new Queue<TrabalhoProcessamento>(NOME_FILA_PROCESSAMENTOS, {
    connection: conexaoRedis(env.START_BACK_REDIS_URL)
  });
  const trabalho = await fila.add("validar-video", { processamentoId }, opcoesTrabalhoVideo(processamentoId));
  return trabalho.id ?? opcoesTrabalhoVideo(processamentoId).jobId ?? processamentoId;
}

/** Enfileira análise visual idempotente sem colocar caminhos ou frames no Redis. */
export async function enfileirarAnaliseVideo(env: ServerEnv, processamentoId: string): Promise<string> {
  fila ??= new Queue<TrabalhoProcessamento>(NOME_FILA_PROCESSAMENTOS, {
    connection: conexaoRedis(env.START_BACK_REDIS_URL)
  });
  const opcoes = { ...opcoesTrabalhoVideo(processamentoId), jobId: `analisar-video-${processamentoId}`, attempts: 1 };
  const trabalho = await fila.add("analisar-video", { processamentoId, tipo: "analisar_video" }, opcoes);
  return trabalho.id ?? opcoes.jobId;
}

/** Enfileira voz/render sem transportar texto, chaves ou caminhos pelo Redis. */
export async function enfileirarNarracao(env: ServerEnv, processamentoId: string): Promise<string> {
  fila ??= new Queue<TrabalhoProcessamento>(NOME_FILA_PROCESSAMENTOS, { connection: conexaoRedis(env.START_BACK_REDIS_URL) });
  const opcoes = { ...opcoesTrabalhoVideo(processamentoId), jobId: `gerar-narracao-${processamentoId}`, attempts: 1 };
  const trabalho = await fila.add("gerar-narracao", { processamentoId, tipo: "gerar_narracao" }, opcoes);
  return trabalho.id ?? opcoes.jobId;
}

/** Converte a URL Redis em opções aceitas pelo BullMQ sem registrar credenciais. */
export function conexaoRedis(redisUrl: string, maxRetriesPerRequest: number | null = 1) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    connectTimeout: 2_000,
    maxRetriesPerRequest
  };
}
