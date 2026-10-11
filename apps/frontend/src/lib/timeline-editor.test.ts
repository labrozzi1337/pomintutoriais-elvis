import { expect, it } from "vitest";
import { dividirBloco, unirBlocos } from "./timeline-editor";
import type { BlocoEstudio } from "./estudio-api";

it("divide e une mantendo limites e sem reaproveitar áudio incompatível", () => {
  const bloco = { id: "id", inicio_ms: 120, fim_ms: 135600, narracao: "Uma frase completa aqui", acao_visual: "Tela", evidencias_frame: [], narracaoGerada: null } as unknown as BlocoEstudio;
  const divididos = dividirBloco([bloco], 0);
  expect(divididos[0]!.fim_ms).toBe(divididos[1]!.inicio_ms);
  expect(divididos[1]!.id).toBe("");
  const unidos = unirBlocos(divididos, 0);
  expect(unidos[0]!.narracao).toBe(bloco.narracao);
  expect(unidos[0]!.fim_ms).toBe(135600);
  expect(bloco.fim_ms).toBe(135600);
});
