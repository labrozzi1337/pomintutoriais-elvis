import { spawn } from "node:child_process";
import { z } from "zod";

const ffprobeSchema = z.object({
  format: z.object({ duration: z.string(), format_name: z.string() }),
  streams: z.array(z.object({
    codec_type: z.enum(["video", "audio", "subtitle", "data", "attachment"]).or(z.string()),
    width: z.number().optional(),
    height: z.number().optional(),
    avg_frame_rate: z.string().optional()
  }).passthrough())
});

export interface MetadadosVideo {
  duracaoMs: number;
  largura: number;
  altura: number;
  fps: number;
  possuiAudio: boolean;
}

export interface MetadadosAudio {
  duracaoMs: number;
  codec: string;
}

/** Executa FFprobe com argumentos fixos e valida os metadados relevantes do MP4. */
export async function inspecionarVideo(caminho: string, timeoutMs = 30_000): Promise<MetadadosVideo> {
  const saida = await executarFfprobe(caminho, timeoutMs);
  const dados = ffprobeSchema.parse(JSON.parse(saida) as unknown);
  const video = dados.streams.find((stream) => stream.codec_type === "video");
  const duracaoMs = Math.round(Number(dados.format.duration) * 1_000);
  const fps = calcularFps(video?.avg_frame_rate);
  if (!dados.format.format_name.includes("mp4") || !video?.width || !video.height || !Number.isFinite(duracaoMs) || duracaoMs <= 0 || fps <= 0) {
    throw new Error("VIDEO_INVALID");
  }
  return { duracaoMs, largura: video.width, altura: video.height, fps, possuiAudio: dados.streams.some((stream) => stream.codec_type === "audio") };
}

/** Rejeita respostas Fish vazias ou arquivos sem stream de áudio decodificável. */
export async function inspecionarAudio(caminho: string, timeoutMs = 30_000): Promise<MetadadosAudio> {
  const saida = await executarFfprobe(caminho, timeoutMs);
  const dados = ffprobeSchema.parse(JSON.parse(saida) as unknown);
  const audio = dados.streams.find((stream) => stream.codec_type === "audio") as { codec_name?: string } | undefined;
  const duracaoMs = Math.round(Number(dados.format.duration) * 1_000);
  if (!audio?.codec_name || !Number.isFinite(duracaoMs) || duracaoMs <= 0) throw new Error("AUDIO_INVALID");
  return { duracaoMs, codec: audio.codec_name };
}

/** Converte a fração de FPS informada pelo FFprobe para número finito. */
export function calcularFps(fracao?: string): number {
  if (!fracao) return 0;
  const [numerador, denominador] = fracao.split("/").map(Number);
  if (!numerador || !denominador) return 0;
  return numerador / denominador;
}

/** Captura stdout e encerra FFprobe quando excede o limite de execução. */
function executarFfprobe(caminho: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", caminho], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => processo.kill("SIGKILL"), timeoutMs);
    processo.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    processo.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    processo.on("error", (error) => { clearTimeout(timer); reject(error); });
    processo.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`FFPROBE_FAILED:${code ?? "unknown"}:${stderr.slice(0, 200)}`));
    });
  });
}
