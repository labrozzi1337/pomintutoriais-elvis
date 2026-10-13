import { readFile } from "node:fs/promises";
import path from "node:path";
import { APIError, Sandbox } from "@vercel/sandbox";
import { FatalError } from "workflow";
import { z } from "zod";
import { getServerEnv } from "@/config/env";
import { b2Configurada } from "@/services/b2";
import type { NomeProcessamento } from "./video";

export async function iniciarSandbox(id: string, nome: NomeProcessamento, runId: string, sandboxName: string): Promise<void> {
  "use step";
  const env = getServerEnv();
  if (!env.ok || !b2Configurada()) throw new FatalError("PROCESSING_CONFIGURATION_REQUIRED");
  // Somente credenciais necessárias ao processador; nunca encaminhar tokens da Vercel.
  const segredos: Record<string, string> = {};
  for (const [key, value] of Object.entries(env.data)) segredos[key] = String(value);
  for (const key of ["B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_NAME", "B2_ENDPOINT", "B2_REGION"]) {
    segredos[key] = process.env[key]!;
  }
  segredos.START_BACK_STORAGE_ROOT = "/tmp/pomin-estudio";
  const sandbox = await Sandbox.getOrCreate({
    name: sandboxName, image: "vercel/sandbox/node:24", persistent: false,
    timeout: 44 * 60 * 1000, resources: { vcpus: 2 }
  });
  await sandbox.writeFiles([{ path: "worker.cjs", content: await readFile(path.join(process.cwd(), "dist/sandbox-worker.cjs")) }]);
  // O lock no sandbox impede repetir chamadas de IA quando o passo é entregue novamente.
  await sandbox.runCommand({
    cmd: "sh", detached: true, env: segredos,
    args: ["-c", `if mkdir .executando 2>/dev/null; then
npm install --no-audit --no-fund ffmpeg-static@5.3.0 ffprobe-static@3.1.0 > instalacao.log 2>&1 &&
mkdir -p bin &&
ln -sf "$PWD/node_modules/ffmpeg-static/ffmpeg" bin/ffmpeg &&
ln -sf "$PWD/node_modules/ffprobe-static/bin/linux/x64/ffprobe" bin/ffprobe &&
PATH="$PWD/bin:$PATH" node worker.cjs "$1" "$2" "$3"
code=$?
printf '%s' "$code" > fim.tmp
mv fim.tmp fim.txt
fi`, "pomin-worker", id, nome, runId]
  });
}

export async function consultarSandbox(name: string): Promise<{ proximo: string | null } | null> {
  "use step";
  const sandbox = await Sandbox.get({ name });
  const fim = await sandbox.readFileToBuffer({ path: "fim.txt" });
  if (!fim) return null;
  if (fim.toString().trim() !== "0") throw new FatalError("SANDBOX_PROCESSING_FAILED");
  const resultado = await sandbox.readFileToBuffer({ path: "resultado.json" });
  if (!resultado) throw new FatalError("SANDBOX_RESULT_MISSING");
  return z.object({ proximo: z.uuid().nullable() }).parse(JSON.parse(resultado.toString()) as unknown);
}

export async function encerrarSandbox(name: string): Promise<void> {
  "use step";
  try {
    const sandbox = await Sandbox.get({ name });
    if (sandbox.status !== "stopped" && sandbox.status !== "failed" && sandbox.status !== "aborted") await sandbox.stop();
  } catch (error) {
    if (!(error instanceof APIError && error.response.status === 404)) throw error;
  }
}

export async function falharProcessamento(id: string, nome: NomeProcessamento): Promise<void> {
  "use step";
  const { registrarFalhaFinal } = await import("@/processador");
  await registrarFalhaFinal(id, nome);
}
