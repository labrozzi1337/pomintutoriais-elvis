import { getWorkflowMetadata, sleep } from "workflow";
import { iniciarSandbox, consultarSandbox, encerrarSandbox, falharProcessamento } from "./video-steps";

export type NomeProcessamento = "validar-video" | "analisar-video" | "gerar-narracao";

export async function processarVideoNaVercel(processamentoId: string, nome: NomeProcessamento): Promise<void> {
  "use workflow";
  const runId = getWorkflowMetadata().workflowRunId;
  let atual: string | null = processamentoId;
  while (atual) {
    const id: string = atual;
    const sandbox = `pomin-${id}`;
    try {
      await iniciarSandbox(id, nome, runId, sandbox);
      let terminou = false;
      // shortcut: 44 minutos por etapa no Hobby; dividir renderizações maiores antes de ampliar o limite.
      for (let tentativa = 0; tentativa < 132; tentativa++) {
        await sleep("20s");
        const resultado = await consultarSandbox(sandbox);
        if (resultado) {
          atual = resultado.proximo;
          terminou = true;
          break;
        }
      }
      if (!terminou) throw new Error("PROCESSING_TIMEOUT");
    } catch (error) {
      await falharProcessamento(id, nome);
      throw error;
    } finally {
      await encerrarSandbox(sandbox);
    }
    nome = "gerar-narracao";
  }
}
