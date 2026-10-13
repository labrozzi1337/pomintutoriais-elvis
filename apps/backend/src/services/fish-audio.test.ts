import { describe, expect, it, vi } from "vitest";
import { hashNarracao, prepararTextoFish, ProvedorFishAudio } from "./fish-audio";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("ProvedorFishAudio", () => {
  it("envia o contrato Fish e grava o MP3 de forma atômica", async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), "fish-test-"));
    const destino = path.join(pasta, "audio.mp3");
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("model")).toBe("s2.1-pro-free");
      if (typeof init?.body !== "string") throw new Error("JSON_BODY_REQUIRED");
      expect(JSON.parse(init.body)).toMatchObject({ text: prepararTextoFish("Olá mundo"), reference_id: "voz", format: "mp3", temperature: 0.6, latency: "normal", normalize: false, prosody: { normalize_loudness: true } });
      return Promise.resolve(new Response(Buffer.alloc(512, 1), { status: 200 }));
    });
    await new ProvedorFishAudio("chave-teste-com-tamanho-suficiente", fetchMock).gerar({
      texto: " Olá   mundo ", referenceId: "voz", destino, configuracao: { modelo: "s2.1-pro-free" }
    });
    expect((await readFile(destino)).length).toBe(512);
    await rm(pasta, { recursive: true, force: true });
  });

  it("inclui texto, voz e modelo no hash", () => {
    const base = hashNarracao("texto", "voz", { modelo: "s2.1-pro-free" });
    expect(hashNarracao(" texto ", "voz", { modelo: "s2.1-pro-free" })).toBe(base);
    expect(hashNarracao("outro", "voz", { modelo: "s2.1-pro-free" })).not.toBe(base);
    expect(hashNarracao("texto", "voz", { modelo: "s2.1-pro" })).not.toBe(base);
    expect(hashNarracao("texto", "voz", { modelo: "s2.1-pro-free" }, "fish-v1")).not.toBe(base);
  });

  it("orienta pt-BR e fecha frases sem duplicar pontuação ou gerar voz para texto vazio", () => {
    expect(prepararTextoFish(" Selecione   o cliente, ")).toContain("] Selecione o cliente.");
    expect(prepararTextoFish("Confira o relatório...")).toContain("] Confira o relatório.");
    expect(prepararTextoFish("Consulta concluída.")).toContain("] Consulta concluída.");
    expect(prepararTextoFish('Abra a opção "Relatório".')).toContain('] Abra a opção "Relatório".');
    expect(prepararTextoFish("Qual cliente?")).toContain("] Qual cliente?");
    expect(prepararTextoFish("Texto")).toContain("português brasileiro");
    expect(() => prepararTextoFish("  ")).toThrow("FISH_EMPTY_TEXT");
  });

  it("limita retry de 429 e não repete falha de rede nem pedido já cancelado", async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), "fish-fail-test-"));
    const entrada = { texto: "Texto", referenceId: "voz", destino: path.join(pasta, "audio.mp3"), configuracao: { modelo: "s2.1-pro" as const } };
    try {
      const limitado = vi.fn(() => Promise.resolve(new Response("limite", { status: 429 })));
      await expect(new ProvedorFishAudio("teste", limitado).gerar(entrada)).rejects.toThrow("FISH_UNAVAILABLE:429");
      expect(limitado).toHaveBeenCalledTimes(3);
      const rede = vi.fn(() => Promise.reject(new Error("NETWORK_TEST")));
      await expect(new ProvedorFishAudio("teste", rede).gerar(entrada)).rejects.toThrow("NETWORK_TEST");
      expect(rede).toHaveBeenCalledTimes(1);
      await expect(new ProvedorFishAudio("teste", rede).gerar({ ...entrada, signal: AbortSignal.abort(new Error("CANCELLED")) })).rejects.toThrow("CANCELLED");
      expect(rede).toHaveBeenCalledTimes(1);
    } finally { await rm(pasta, { recursive: true, force: true }); }
  });
});
