export interface IntervaloBytes {
  inicio: number;
  fim: number;
}

/** Interpreta um único intervalo HTTP, incluindo sufixo, dentro do tamanho real. */
export function interpretarRange(header: string | null, tamanho: number): IntervaloBytes | null | "invalido" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalido";
  const inicioTexto = match[1] ?? "";
  const fimTexto = match[2] ?? "";
  if (!inicioTexto && !fimTexto) return "invalido";
  if (!inicioTexto) {
    const sufixo = Number(fimTexto);
    if (!Number.isInteger(sufixo) || sufixo <= 0) return "invalido";
    return { inicio: Math.max(0, tamanho - sufixo), fim: tamanho - 1 };
  }
  const inicio = Number(inicioTexto);
  const fim = fimTexto ? Number(fimTexto) : tamanho - 1;
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 0 || inicio >= tamanho || fim < inicio) return "invalido";
  return { inicio, fim: Math.min(fim, tamanho - 1) };
}
