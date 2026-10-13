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
  if (!Number.isInteger(limite) || limite <= 0) throw new Error("FRAME_LIMIT_INVALID");
  const diretorio = await mkdtemp(path.join(tmpdir(), "estudio-quadros-"));
  try {
    const seletor = "select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,2)+gt(scene\\,0.30)'";
    // O primeiro passe lê até o fim sem gravar JPEGs, para cortes iniciais não consumirem todo o orçamento.
    const stderr = await executarFfmpeg(["-hide_banner", "-i", caminhoVideo, "-vf", `${seletor},showinfo`, "-fps_mode", "vfr", "-an", "-f", "null", "-"]);
    const tempos = [...stderr.matchAll(/pts_time:([0-9.]+)/gu)].map((item) => Math.round(Number(item[1]) * 1_000));
    if (tempos.length === 0) throw new Error("FRAME_EXTRACTION_EMPTY");
    const indices = selecionarIndices(tempos, limite);
    const filtro = `${seletor},select='${indices.map((indice) => `eq(n\\,${indice})`).join("+")}',scale='min(1280,iw)':-2`;
    await executarFfmpeg(["-hide_banner", "-i", caminhoVideo, "-vf", filtro, "-fps_mode", "vfr", "-frames:v", String(limite), "-q:v", "3", path.join(diretorio, "quadro-%04d.jpg")]);
    const arquivos = (await readdir(diretorio)).filter((arquivo) => arquivo.endsWith(".jpg")).sort();
    if (arquivos.length !== indices.length) throw new Error("FRAME_EXTRACTION_EMPTY");
    const quadros = arquivos.map((arquivo, indice) => {
      const indiceCandidato = indices[indice]!;
      const timestampMs = tempos[indiceCandidato]!;
      return {
        caminho: path.join(diretorio, arquivo),
        timestampMs,
        corteProvavel: indiceCandidato > 0 && timestampMs - tempos[indiceCandidato - 1]! < 1_500
      };
    });
    return { quadros, limpar: () => rm(diretorio, { recursive: true, force: true }) };
  } catch (error) {
    await rm(diretorio, { recursive: true, force: true });
    throw error;
  }
}

/** Preserva as pontas e escolhe mudanças visuais em faixas distribuídas por todo o vídeo. */
function selecionarIndices(tempos: number[], limite: number): number[] {
  if (tempos.length <= limite) return tempos.map((_, indice) => indice);
  if (limite === 1) return [0];
  const indices = new Set([0, tempos.length - 1]);
  const faixas = limite - 2;
  const inicio = tempos[0]!;
  const duracao = tempos[tempos.length - 1]! - inicio;
  for (let faixa = 0; faixa < faixas; faixa += 1) {
    const minimo = inicio + duracao * faixa / faixas;
    const maximo = inicio + duracao * (faixa + 1) / faixas;
    const centro = (minimo + maximo) / 2;
    let escolhido: number | undefined;
    for (let indice = 1; indice < tempos.length - 1; indice += 1) {
      const tempo = tempos[indice]!;
      if (tempo < minimo || tempo >= maximo) continue;
      if (tempo - tempos[indice - 1]! < 1_500) { escolhido = indice; break; }
      if (escolhido === undefined || Math.abs(tempo - centro) < Math.abs(tempos[escolhido]! - centro)) escolhido = indice;
    }
    if (escolhido !== undefined) indices.add(escolhido);
  }
  const restantes = tempos.map((_, indice) => indice).filter((indice) => !indices.has(indice));
  const vagas = limite - indices.size;
  for (let vaga = 0; vaga < vagas; vaga += 1) indices.add(restantes[Math.floor((vaga + 0.5) * restantes.length / vagas)]!);
  return [...indices].sort((a, b) => a - b);
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
