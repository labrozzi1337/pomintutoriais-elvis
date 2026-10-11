import { spawn } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { inspecionarAudio, inspecionarVideo } from "./ffprobe";

export interface ClipSincronizado {
  caminho: string;
  inicioMs: number;
  taxaAceleracao: number;
}

export type ModoAudioOriginal = "substituir" | "ducking" | "manter_original";

/** Monta a faixa completa com atrasos reais e nunca acelera acima de 12%. */
export async function montarWav(clips: ClipSincronizado[], duracaoVideoMs: number, destino: string, signal?: AbortSignal): Promise<void> {
  if (clips.some((clip) => clip.taxaAceleracao < 1 || clip.taxaAceleracao > 1.12)) throw new Error("AUDIO_SPEED_INVALID");
  const temporario = `${destino}.tmp.wav`;
  await mkdir(path.dirname(destino), { recursive: true });
  const filtros = ["[0:a]volume=0[base]"];
  clips.forEach((clip, indice) => filtros.push(`[${indice + 1}:a]aresample=48000,atempo=${clip.taxaAceleracao.toFixed(5)},adelay=${Math.round(clip.inicioMs)}:all=1[a${indice + 1}]`));
  const entradas = ["-hide_banner", "-loglevel", "warning", "-y", "-f", "lavfi", "-t", String(duracaoVideoMs / 1_000), "-i", "anullsrc=r=48000:cl=stereo"];
  clips.forEach((clip) => entradas.push("-i", clip.caminho));
  const fontes = ["[base]", ...clips.map((_, indice) => `[a${indice + 1}]`)].join("");
  filtros.push(`${fontes}amix=inputs=${clips.length + 1}:duration=first:dropout_transition=0:normalize=0,atrim=0:${duracaoVideoMs / 1_000},asetpts=N/SR/TB[out]`);
  try {
    await executarFfmpeg([...entradas, "-filter_complex", filtros.join(";"), "-map", "[out]", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", temporario], signal);
    await inspecionarAudio(temporario);
    await rename(temporario, destino);
  } finally {
    await rm(temporario, { force: true });
  }
}

/** Produz MP4 atômico preservando o stream de vídeo e validando o resultado. */
export async function renderizarMp4(video: string, wav: string, destino: string, modo: ModoAudioOriginal, signal?: AbortSignal): Promise<void> {
  const origem = await inspecionarVideo(video);
  const temporario = `${destino}.tmp.mp4`;
  await mkdir(path.dirname(destino), { recursive: true });
  let args: string[];
  if (modo === "substituir" || !origem.possuiAudio) {
    args = ["-i", video, "-i", wav, "-map", "0:v:0", "-map", "1:a:0"];
  } else if (modo === "ducking") {
    args = ["-i", video, "-i", wav, "-filter_complex", "[0:a][1:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[baixo];[baixo][1:a]amix=inputs=2:duration=longest:normalize=0[aout]", "-map", "0:v:0", "-map", "[aout]"];
  } else {
    args = ["-i", video, "-i", wav, "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[aout]", "-map", "0:v:0", "-map", "[aout]"];
  }
  try {
    await executarFfmpeg(["-hide_banner", "-loglevel", "warning", "-y", ...args, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(origem.duracaoMs / 1_000), "-movflags", "+faststart", temporario], signal);
    const final = await inspecionarVideo(temporario);
    if (!final.possuiAudio || Math.abs(final.duracaoMs - origem.duracaoMs) > 250) throw new Error("RENDER_VALIDATION_FAILED");
    await rename(temporario, destino);
  } finally {
    await rm(temporario, { force: true });
  }
}

function executarFfmpeg(args: string[], signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const processo = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let expirado = false;
    const timer = setTimeout(() => { expirado = true; processo.kill("SIGKILL"); }, 1_800_000);
    processo.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-2_000); });
    const cancelar = () => processo.kill("SIGKILL");
    signal?.addEventListener("abort", cancelar, { once: true });
    processo.on("error", (error) => { clearTimeout(timer); reject(error); });
    processo.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelar);
      if (signal?.aborted) reject(new Error("FFMPEG_CANCELLED", { cause: signal.reason }));
      else if (expirado) reject(new Error("FFMPEG_TIMEOUT"));
      else if (code === 0) resolve();
      else reject(new Error(`FFMPEG_FAILED:${code ?? "unknown"}:${stderr}`));
    });
  });
}
