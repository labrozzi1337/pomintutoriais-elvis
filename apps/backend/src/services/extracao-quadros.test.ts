import { spawnSync } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { extrairQuadros } from "./extracao-quadros";

it.skipIf(spawnSync("ffmpeg", ["-version"]).status !== 0)("cobre um vídeo longo com cortes concentrados no início sem exceder o limite", async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), "quadros-test-"));
  const video = path.join(pasta, "video.mp4");
  try {
    const criado = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "nullsrc=s=128x72:r=4:d=40,geq=lum='if(lt(T,2),if(eq(mod(floor(N/2),2),0),16,235),80)':cb=128:cr=128", "-c:v", "libx264", video]);
    expect(criado.status, criado.stderr.toString()).toBe(0);
    const extraidos = await extrairQuadros(video, 10);
    try {
      const tempos = extraidos.quadros.map((quadro) => quadro.timestampMs);
      expect(tempos).toHaveLength(10);
      expect(tempos[0]).toBe(0);
      expect(tempos.at(-1)).toBeGreaterThanOrEqual(38_000);
      expect(tempos.some((tempo) => tempo >= 16_000 && tempo <= 24_000)).toBe(true);
      expect(extraidos.quadros.some((quadro) => quadro.corteProvavel && quadro.timestampMs < 2_000)).toBe(true);
      expect(tempos).toEqual([...new Set(tempos)].sort((a, b) => a - b));
      for (const quadro of extraidos.quadros) await access(quadro.caminho);
    } finally { await extraidos.limpar(); }
    await expect(access(path.dirname(extraidos.quadros[0]!.caminho))).rejects.toMatchObject({ code: "ENOENT" });

    const todos = await extrairQuadros(video);
    try {
      expect(todos.quadros.length).toBeGreaterThan(10);
      expect(todos.quadros.slice(0, 4).map((quadro) => quadro.timestampMs)).toEqual([0, 500, 1_000, 1_500]);
      expect(todos.quadros.at(-1)?.timestampMs).toBeGreaterThanOrEqual(38_000);
    } finally { await todos.limpar(); }
  } finally { await rm(pasta, { recursive: true, force: true }); }
}, 30_000);

it("rejeita um limite inválido antes de iniciar FFmpeg", async () => {
  await expect(extrairQuadros("video.mp4", 0)).rejects.toThrow("FRAME_LIMIT_INVALID");
  await expect(extrairQuadros("video.mp4", 1.5)).rejects.toThrow("FRAME_LIMIT_INVALID");
});
