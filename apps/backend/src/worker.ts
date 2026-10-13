import { UnrecoverableError, Worker } from "bullmq";
import { getServerEnv } from "./config/env";
import { log } from "./lib/logger";
import { processar, registrarFalhaFinal } from "./processador";
import { conexaoRedis, enfileirarNarracao, NOME_FILA_PROCESSAMENTOS, type TrabalhoProcessamento } from "./services/fila-processamentos";

const env = getServerEnv();
if (!env.ok) throw new Error(`WORKER_CONFIGURATION_ERROR:${env.issues.join(",")}`);
const configuracao = env.data;
const worker = new Worker<TrabalhoProcessamento>(NOME_FILA_PROCESSAMENTOS,
  (job) => processar(job, (id) => enfileirarNarracao(configuracao, id)), {
    connection: conexaoRedis(configuracao.START_BACK_REDIS_URL, null), concurrency: 2
  });

worker.on("failed", (job, error) => {
  log("error", "Falha no processamento de vídeo.", { event: "worker.video_failed", processamentoId: job?.data.processamentoId, errorCode: error.message });
  if (job && (error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? 1))) {
    void registrarFalhaFinal(job.data.processamentoId, job.name).catch(() => {
      log("error", "Falha ao persistir erro final.", { event: "worker.video_failure_persistence_failed", processamentoId: job.data.processamentoId, errorCode: "FAILURE_PERSISTENCE_FAILED" });
    });
  }
});

async function encerrar(): Promise<void> {
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", () => { void encerrar(); });
process.on("SIGINT", () => { void encerrar(); });
