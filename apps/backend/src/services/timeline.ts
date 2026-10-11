import { z } from "zod";

export const blocoTimelineSchema = z.object({
  id: z.uuid().optional(),
  inicioMs: z.number().int().nonnegative(),
  fimMs: z.number().int().positive(),
  acaoVisual: z.string().trim().min(1).max(2_000),
  narracao: z.string().trim().max(4_000),
  evidenciasFrame: z.array(z.number().int().nonnegative()).max(30),
  confianca: z.number().min(0).max(1)
}).strict();

export type BlocoTimeline = z.infer<typeof blocoTimelineSchema>;

/** Valida limites, ordem e ausência de sobreposição preservando espaços de silêncio. */
export function validarTimeline(blocos: BlocoTimeline[], duracaoVideoMs: number): BlocoTimeline[] {
  const validados = z.array(blocoTimelineSchema).min(1).max(200).parse(blocos);
  let fimAnterior = 0;
  for (const [indice, bloco] of validados.entries()) {
    if (bloco.inicioMs < fimAnterior) throw new Error(`TIMELINE_OVERLAP:${indice}`);
    if (bloco.fimMs <= bloco.inicioMs) throw new Error(`TIMELINE_INVALID_RANGE:${indice}`);
    if (bloco.fimMs > duracaoVideoMs) throw new Error(`TIMELINE_OUT_OF_VIDEO:${indice}`);
    if (bloco.evidenciasFrame.some((tempo) => tempo < bloco.inicioMs || tempo > bloco.fimMs)) {
      throw new Error(`TIMELINE_EVIDENCE_OUT_OF_RANGE:${indice}`);
    }
    fimAnterior = bloco.fimMs;
  }
  return validados;
}

/** Estima fala para orientar revisão; a duração definitiva virá do áudio medido por FFprobe. */
export function estimarDuracaoFalaMs(texto: string): number {
  const palavras = texto.trim() ? texto.trim().split(/\s+/u).length : 0;
  const pausas = (texto.match(/[,.!?;:]/gu) ?? []).length;
  return Math.round((palavras / 2.5) * 1_000 + pausas * 140);
}
