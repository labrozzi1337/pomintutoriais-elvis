import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { montarWav, renderizarMp4 } from "./renderizar-narracao";
import { inspecionarAudio, inspecionarVideo } from "./ffprobe";

it.skipIf(spawnSync("ffmpeg", ["-version"]).status !== 0)("FFmpeg real: sincroniza, mistura nos três modos e cancela sem produto parcial", async () => {
  const pasta = await mkdtemp(path.join(os.tmpdir(), "render-test-"));
  const video = path.join(pasta, "video.mp4"), clip = path.join(pasta, "clip.mp3"), wav = path.join(pasta, "narracao.wav");
  try {
    const criado = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=25:d=2", "-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-c:v", "libx264", "-c:a", "aac", "-shortest", video]);
    expect(criado.status).toBe(0);
    expect(spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", clip]).status).toBe(0);
    await montarWav([{ caminho: clip, inicioMs: 200, taxaAceleracao: 1.12 }], 2000, wav);
    expect((await inspecionarAudio(wav)).duracaoMs).toBe(2000);
    for (const modo of ["substituir", "ducking", "manter_original"] as const) {
      const destino = path.join(pasta, `${modo}.mp4`);
      await renderizarMp4(video, wav, destino, modo);
      expect(await inspecionarVideo(destino)).toMatchObject({ duracaoMs: 2000, possuiAudio: true });
    }
    const semAudio = path.join(pasta, "sem-audio.mp4");
    expect(spawnSync("ffmpeg", ["-v", "error", "-i", video, "-an", "-c:v", "copy", semAudio]).status).toBe(0);
    await renderizarMp4(semAudio, wav, path.join(pasta, "narrado-sem-original.mp4"), "ducking");
    expect(await inspecionarVideo(path.join(pasta, "narrado-sem-original.mp4"))).toMatchObject({ duracaoMs: 2000, possuiAudio: true });
    const cancelar = new AbortController();
    const interrompido = montarWav([{ caminho: clip, inicioMs: 0, taxaAceleracao: 1 }], 3600000, path.join(pasta, "cancelado.wav"), cancelar.signal);
    const timer = setTimeout(() => cancelar.abort(new Error("CANCELLED")), 100);
    try { await expect(interrompido).rejects.toThrow("FFMPEG_CANCELLED"); }
    finally { clearTimeout(timer); }
    await expect(montarWav([{ caminho: clip, inicioMs: 0, taxaAceleracao: 1.121 }], 2000, wav)).rejects.toThrow("AUDIO_SPEED_INVALID");
    await expect(montarWav([], 2000, wav, AbortSignal.abort(new Error("CANCELLED")))).rejects.toThrow("CANCELLED");
    const corrompido = path.join(pasta, "corrompido.mp3");
    await writeFile(corrompido, Buffer.alloc(512));
    await expect(inspecionarAudio(corrompido)).rejects.toThrow();
  } finally { await rm(pasta, { recursive: true, force: true }); }
}, 30000);
