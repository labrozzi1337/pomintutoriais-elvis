export interface CenaLegenda { inicioMs: number; fimMs: number; texto: string }

export function gerarLegendas(cenas: CenaLegenda[], formato: "srt" | "vtt"): string {
  const separador = formato === "srt" ? "," : ".";
  const tempo = (ms: number) => {
    const total = Math.floor(ms / 1000);
    return `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}${separador}${String(ms % 1000).padStart(3, "0")}`;
  };
  const falas = cenas.filter((cena) => cena.texto.trim());
  if (falas.some((cena, i) => !Number.isInteger(cena.inicioMs) || !Number.isInteger(cena.fimMs) || cena.inicioMs < 0 || cena.fimMs <= cena.inicioMs || (i > 0 && cena.inicioMs < falas[i - 1]!.fimMs))) throw new Error("SUBTITLE_TIMELINE_INVALID");
  return (formato === "vtt" ? "WEBVTT\n\n" : "") + falas.map((cena, i) => `${i + 1}\n${tempo(cena.inicioMs)} --> ${tempo(cena.fimMs)}\n${cena.texto.replace(/<[^>]*>/g, "").replace(/-->/g, "→").replace(/\s+/g, " ").trim()}\n`).join("\n");
}
