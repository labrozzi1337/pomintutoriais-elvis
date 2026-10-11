import type { ProcessamentoEstudio } from "./estudio-api";

function converterParaFluxo(processamento: ProcessamentoEstudio, progresso: number): number {
  if (processamento.tipo === "analisar_video" && processamento.configuracao.narracao) return progresso * 0.45;
  if (processamento.tipo === "gerar_narracao" && processamento.configuracao.fluxoAutomatico) return 45 + progresso * 0.55;
  return progresso;
}

export function percentualDoFluxo(processamento: ProcessamentoEstudio): number {
  return converterParaFluxo(processamento, processamento.progresso);
}

/** Limita a animação ao marco imediatamente anterior à próxima etapa confirmada pelo worker. */
export function limiteVisualDoFluxo(processamento: ProcessamentoEstudio): number {
  let limite = processamento.progresso;
  if (processamento.status === "recebido") limite = processamento.tipo === "validar_video" ? 19.99 : processamento.tipo === "analisar_video" ? 9.99 : 4.99;
  else if (processamento.status === "processando_video") limite = 99.99;
  else if (processamento.status === "analisando") limite = processamento.progresso < 35 ? 34.99 : processamento.progresso < 85 ? 84.99 : 99.99;
  else if (processamento.status === "gerando_voz") limite = 64.99;
  else if (processamento.status === "validando_duracoes") limite = 74.99;
  else if (processamento.status === "renderizando") limite = 94.99;
  else if (processamento.status === "verificando_resultado") limite = 99.99;
  return Math.max(percentualDoFluxo(processamento), Math.min(99.99, converterParaFluxo(processamento, limite)));
}

export function avancarPercentualVisual(atual: number, percentualReal: number, limite: number): number {
  if (atual >= limite) return atual;
  const distanciaReal = percentualReal - atual;
  const passo = distanciaReal > 0 ? Math.max(0.05, distanciaReal * 0.18) : Math.max(0.01, (limite - atual) * 0.0015);
  return Math.min(limite, Math.round((atual + passo) * 100) / 100);
}
