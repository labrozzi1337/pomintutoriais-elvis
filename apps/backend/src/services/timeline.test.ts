import { describe, expect, it } from "vitest";
import { estimarDuracaoFalaMs, validarTimeline, type BlocoTimeline } from "@/services/timeline";

const bloco = (inicioMs: number, fimMs: number, narracao = "Abra o menu."): BlocoTimeline => ({
  inicioMs, fimMs, acaoVisual: "O usuário navega na interface.", narracao,
  evidenciasFrame: [inicioMs], confianca: 0.9
});

describe("timeline de roteiro", () => {
  it("aceita cortes rápidos e espaços de silêncio em milissegundos", () => {
    expect(validarTimeline([bloco(0, 350), bloco(900, 1_250)], 1_300)).toHaveLength(2);
  });

  it("rejeita sobreposição e blocos fora de vídeo curto", () => {
    expect(() => validarTimeline([bloco(0, 700), bloco(650, 900)], 1_000)).toThrow("TIMELINE_OVERLAP");
    expect(() => validarTimeline([bloco(0, 1_001)], 1_000)).toThrow("TIMELINE_OUT_OF_VIDEO");
  });

  it("estima mais tempo para texto com mais palavras e pausas", () => {
    expect(estimarDuracaoFalaMs("Abra.")) .toBeLessThan(estimarDuracaoFalaMs("Abra o menu, escolha a opção e confirme."));
  });
});
