import type { BlocoEstudio } from "./estudio-api";

export function dividirBloco(blocos: BlocoEstudio[], indice: number): BlocoEstudio[] {
  const bloco = blocos[indice];
  if (!bloco || bloco.fim_ms - bloco.inicio_ms < 2) throw new Error("A cena precisa ter pelo menos 2 ms para dividir.");
  const corte = Math.floor((bloco.inicio_ms + bloco.fim_ms) / 2);
  const palavras = bloco.narracao.split(/\s+/);
  const meio = Math.ceil(palavras.length / 2);
  return [...blocos.slice(0, indice), { ...bloco, fim_ms: corte, narracao: palavras.slice(0, meio).join(" "), narracaoGerada: null }, { ...bloco, id: "", inicio_ms: corte, narracao: palavras.slice(meio).join(" "), narracaoGerada: null }, ...blocos.slice(indice + 1)];
}

export function unirBlocos(blocos: BlocoEstudio[], indice: number): BlocoEstudio[] {
  const primeiro = blocos[indice], segundo = blocos[indice + 1];
  if (!primeiro || !segundo) throw new Error("Selecione uma cena que tenha uma próxima cena.");
  return [...blocos.slice(0, indice), { ...primeiro, fim_ms: segundo.fim_ms, narracao: `${primeiro.narracao} ${segundo.narracao}`.trim(), acao_visual: `${primeiro.acao_visual} ${segundo.acao_visual}`, evidencias_frame: [...primeiro.evidencias_frame, ...segundo.evidencias_frame].slice(0, 30), narracaoGerada: null }, ...blocos.slice(indice + 2)];
}
