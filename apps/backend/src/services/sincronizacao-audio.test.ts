import { describe, expect, it } from "vitest";
import { avaliarDuracoes } from "./sincronizacao-audio";

describe("avaliarDuracoes", () => {
  it("preserva válidos e relata todos os estouros", () => {
    const resultado = avaliarDuracoes([
      { blocoId: "11", inicioMs: 0, fimMs: 10_000, duracaoAudioMs: 10_500 },
      { blocoId: "12", inicioMs: 10_000, fimMs: 15_000, duracaoAudioMs: 6_000 },
      { blocoId: "13", inicioMs: 15_000, fimMs: 20_000, duracaoAudioMs: 7_000 }
    ]);
    expect(resultado.map((item) => item.status)).toEqual(["valido", "ajuste_necessario", "ajuste_necessario"]);
    expect(resultado[0]?.taxaAceleracao).toBeCloseTo(1.05);
  });
  it("aceita exatamente 12%, rejeita acima e não aceita voz de zero segundos", () => {
    expect(avaliarDuracoes([{ blocoId: "a", inicioMs: 0, fimMs: 10000, duracaoAudioMs: 11200 }])[0]?.status).toBe("valido");
    expect(avaliarDuracoes([{ blocoId: "a", inicioMs: 0, fimMs: 10000, duracaoAudioMs: 11201 }])[0]?.status).toBe("ajuste_necessario");
    expect(() => avaliarDuracoes([{ blocoId: "a", inicioMs: 0, fimMs: 10000, duracaoAudioMs: 0 }])).toThrow("AUDIO_TIMELINE_INVALID");
  });
});
