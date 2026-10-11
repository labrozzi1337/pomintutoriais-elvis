export interface MedicaoNarracao {
  blocoId: string;
  inicioMs: number;
  fimMs: number;
  duracaoAudioMs: number;
}

export interface ResultadoMedicao extends MedicaoNarracao {
  taxaAceleracao: number;
  status: "valido" | "ajuste_necessario";
}

/** Mede todos os blocos sem interromper a rodada no primeiro estouro. */
export function avaliarDuracoes(blocos: MedicaoNarracao[]): ResultadoMedicao[] {
  return blocos.map((bloco) => {
    const janela = bloco.fimMs - bloco.inicioMs;
    if (janela <= 0 || bloco.duracaoAudioMs <= 0) throw new Error("AUDIO_TIMELINE_INVALID");
    const taxaAceleracao = Math.max(1, bloco.duracaoAudioMs / janela);
    return { ...bloco, taxaAceleracao, status: taxaAceleracao <= 1.12 ? "valido" : "ajuste_necessario" };
  });
}
