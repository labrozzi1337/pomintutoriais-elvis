import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { processar, registrarFalhaFinal } from "./processador";

async function executar(): Promise<void> {
  const [processamentoId, nome, runId] = z.tuple([
    z.uuid(), z.enum(["validar-video", "analisar-video", "gerar-narracao"]), z.string().min(1)
  ]).parse(process.argv.slice(2));
  let proximo: string | null = null;
  try {
    await processar({ name: nome, data: { processamentoId } }, (id) => {
      proximo = id;
      return Promise.resolve(runId);
    });
    await writeFile("resultado.json", JSON.stringify({ proximo }));
  } catch {
    await registrarFalhaFinal(processamentoId, nome);
    throw new Error("SANDBOX_PROCESSING_FAILED");
  }
}
void executar().catch(() => { console.error("SANDBOX_PROCESSING_FAILED"); process.exitCode = 1; });
