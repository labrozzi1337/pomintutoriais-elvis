import path from "node:path";

/** Não confia em vínculos/chaves inseridos diretamente pela Data API. */
export function arquivoDoProjeto(projetoId: string, arquivo: { projeto_id: string; chave_armazenamento: string; tipo: string; mime_type: string }): boolean {
  const tipos: Record<string, string[]> = { video_original: ["video/mp4"], video_final: ["video/mp4"], audio: ["audio/mpeg", "audio/wav"], legenda: ["text/vtt", "application/x-subrip"], thumbnail: ["image/jpeg", "image/png"] };
  return tipos[arquivo.tipo]?.includes(arquivo.mime_type) === true && arquivo.projeto_id === projetoId && !arquivo.chave_armazenamento.includes("\\") && path.posix.normalize(arquivo.chave_armazenamento).startsWith(`projetos/${projetoId}/`);
}
