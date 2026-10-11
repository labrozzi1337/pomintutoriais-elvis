import { avaliarDuracoes } from "./sincronizacao-audio";

export async function ajustarNarracao<T extends { texto: string; duracaoMs: number }>(
  clip: T, janelaMs: number, reescrever: (texto: string, duracaoMs: number) => Promise<string>, gerar: (texto: string, tentativa: number) => Promise<T>
): Promise<T> {
  let atual = clip;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    if (avaliarDuracoes([{ blocoId: "bloco", inicioMs: 0, fimMs: janelaMs, duracaoAudioMs: atual.duracaoMs }])[0]!.status === "valido") break;
    const texto = await reescrever(atual.texto, atual.duracaoMs);
    if (!texto.trim() || texto.length >= atual.texto.length) break;
    atual = await gerar(texto, tentativa);
  }
  return atual;
}
