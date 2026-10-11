import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface QuadroVideo {
  caminho: string;
  timestampMs: number;
  corteProvavel: boolean;
}

export interface QuadrosExtraidos {
  quadros: QuadroVideo[];
  limpar: () => Promise<void>;
}

/** Extrai quadros periódicos e extras em mudanças visuais, mantendo o timestamp real do FFmpeg. */
export async function extrairQuadros(caminhoVideo: string, limite = 120): Promise<QuadrosExtraidos> {
  const diretorio = await mkdtemp(path.join(tmpdir(), "estudio-quadros-"));
  try {
    const filtro = "select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,2)+gt(scene\\,0.30)',scale='min(1280,iw)':-2,showinfo";
    const stderr = await executarFfmpeg(["-hide_banner", "-i", caminhoVideo, "-vf", filtro, "-fps_mode", "vfr", "-frames:v", String(limite), "-q:v", "3", path.join(diretorio, "quadro-%04d.jpg")]);
    const tempos = [...stderr.matchAll(/pts_time:([0-9.]+)/gu)].map((item) => Math.round(Number(item[1]) * 1_000));
    const arquivos = (await readdir(diretorio)).filter((arquivo) => arquivo.endsWith(".jpg")).sort();
    if (arquivos.length === 0 || tempos.length < arquivos.length) throw new Error("FRAME_EXTRACTION_EMPTY");
    const quadros = arquivos.map((arquivo, indice) => {
      const timestampMs = tempos[indice]!;
      return {
        caminho: path.join(diretorio, arquivo),
        timestampMs,
        corteProvavel: indice > 0 && timestampMs - tempos[indice - 1]! < 1_500
      };
    });
    return { quadros, limpar: () => rm(diretorio, { recursive: true, force: true }) };
  } catch (error) {
    await rm(diretorio, { recursive: true, force: true });
    throw error;
  }
}

/** Executa FFmpeg com timeout e limita o detalhe de erro retornado. */
function executarFfmpeg(argumentos: string[], timeoutMs = 180_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const processo = spawn("ffmpeg", argumentos, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => processo.kill("SIGKILL"), timeoutMs);
    processo.stderr.setEncoding("utf8").on("data", (parte: string) => { stderr += parte; });
    processo.on("error", (error) => { clearTimeout(timer); reject(error); });
    processo.on("close", (codigo) => {
      clearTimeout(timer);
      if (codigo === 0) resolve(stderr);
      else reject(new Error(`FFMPEG_FRAME_EXTRACTION_FAILED:${codigo ?? "unknown"}:${stderr.slice(-300)}`));
    });
  });
}
