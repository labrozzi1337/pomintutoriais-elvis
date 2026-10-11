export type Ponto = { x: number; y: number };
export type Direcao = "cima" | "baixo" | "esquerda" | "direita";

export const larguraCobrinha = 16;
export const alturaCobrinha = 12;
const movimentos: Record<Direcao, Ponto> = { cima: { x: 0, y: -1 }, baixo: { x: 0, y: 1 }, esquerda: { x: -1, y: 0 }, direita: { x: 1, y: 0 } };

export function moverCobrinha(corpo: Ponto[], direcao: Direcao, comida: Ponto) {
  const movimento = movimentos[direcao];
  const cabeca = {
    x: (corpo[0]!.x + movimento.x + larguraCobrinha) % larguraCobrinha,
    y: (corpo[0]!.y + movimento.y + alturaCobrinha) % alturaCobrinha
  };
  const comeu = cabeca.x === comida.x && cabeca.y === comida.y;
  const novoCorpo = [cabeca, ...(comeu ? corpo : corpo.slice(0, -1))];
  return { corpo: novoCorpo, comeu, colidiu: novoCorpo.slice(1).some((ponto) => ponto.x === cabeca.x && ponto.y === cabeca.y) };
}

export function novaComida(corpo: Ponto[]): Ponto {
  const livres = Array.from({ length: larguraCobrinha * alturaCobrinha }, (_, indice) => ({ x: indice % larguraCobrinha, y: Math.floor(indice / larguraCobrinha) })).filter((ponto) => !corpo.some((parte) => parte.x === ponto.x && parte.y === ponto.y));
  return livres[Math.floor(Math.random() * livres.length)] ?? { x: 12, y: 6 };
}
