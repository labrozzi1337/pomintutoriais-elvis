import { expect, it } from "vitest";
import type { ProcessamentoEstudio } from "./estudio-api";
import { avancarPercentualVisual, fluxoEmAndamento, limiteVisualDoFluxo, percentualDoFluxo } from "./progresso-processamento";

function processamento(valores: Partial<ProcessamentoEstudio>): ProcessamentoEstudio {
  return { id: crypto.randomUUID(), tipo: "analisar_video", status: "analisando", progresso: 35, mensagem: null, codigo_erro: null, configuracao: {}, criado_em: "2026-10-11", ...valores };
}

it("mantém a tela durante a troca de análise para narração automática", () => {
  expect(fluxoEmAndamento(processamento({ status: "analisando" }))).toBe(true);
  expect(fluxoEmAndamento(processamento({ status: "concluido", configuracao: { narracao: {} } }))).toBe(true);
  expect(fluxoEmAndamento(processamento({ tipo: "gerar_narracao", status: "recebido" }))).toBe(true);
  expect(fluxoEmAndamento(processamento({ tipo: "gerar_narracao", status: "concluido", configuracao: { fluxoAutomatico: true } }))).toBe(false);
});

it("encerra etapas manuais e não prende o usuário em erro ou cancelamento", () => {
  expect(fluxoEmAndamento(undefined)).toBe(false);
  for (const status of ["concluido", "roteiro_pronto", "erro", "cancelado", "ajuste_necessario"]) {
    expect(fluxoEmAndamento(processamento({ status }))).toBe(false);
  }
  for (const status of ["erro", "cancelado", "ajuste_necessario"]) {
    expect(fluxoEmAndamento(processamento({ status, configuracao: { narracao: {} } }))).toBe(false);
  }
});

it("mantém a análise automática abaixo do início da narração enquanto a IA responde", () => {
  const job = processamento({ configuracao: { narracao: {} } });
  expect(percentualDoFluxo(job)).toBe(15.75);
  expect(limiteVisualDoFluxo(job)).toBeCloseTo(38.2455);
  expect(limiteVisualDoFluxo(job)).toBeLessThan(45);
});

it("reserva o final de cada etapa para a confirmação real do worker", () => {
  expect(limiteVisualDoFluxo(processamento({ tipo: "gerar_narracao", status: "renderizando", progresso: 75, configuracao: { fluxoAutomatico: true } }))).toBeCloseTo(97.2445);
  expect(limiteVisualDoFluxo(processamento({ status: "verificando_resultado", progresso: 95 }))).toBe(99.99);
});

it("avança em centésimos sem ultrapassar o limite seguro", () => {
  expect(avancarPercentualVisual(16, 15.75, 38.2455)).toBeGreaterThan(16);
  expect(avancarPercentualVisual(38.24, 15.75, 38.2455)).toBe(38.2455);
});
