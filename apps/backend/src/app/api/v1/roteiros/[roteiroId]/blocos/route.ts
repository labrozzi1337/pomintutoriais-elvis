import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterDuracaoRoteiro, salvarTimeline } from "@/repositories/roteiro-repository";
import { blocoTimelineSchema, validarTimeline } from "@/services/timeline";
import { comLockEdicao } from "@/services/lock-edicao";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ roteiroId: string }> };
const entradaSchema = z.object({ blocos: z.array(blocoTimelineSchema).min(1).max(200), atualizadoEm: z.string().optional() }).strict();

/** Salva a timeline completa para cobrir edição, adição, remoção, divisão, fusão e reordenação. */
export async function PUT(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const roteiroId = validarUuid((await params).roteiroId);
    const duracaoMs = await obterDuracaoRoteiro(contexto.auth.cliente, roteiroId);
    if (!duracaoMs) return respostaErro("NOT_FOUND", "Roteiro não encontrado.", 404);
    const entrada = await lerJson(request, entradaSchema);
    const blocos = validarTimeline(entrada.blocos, duracaoMs);
    const roteiro = await comLockEdicao(contexto.env.START_BACK_REDIS_URL, roteiroId, () => salvarTimeline(contexto.auth.cliente, roteiroId, contexto.auth.usuario.id, blocos, entrada.atualizadoEm));
    return roteiro ? NextResponse.json({ data: roteiro, meta: { requestId } }) : respostaErro("NOT_FOUND", "Roteiro não encontrado.", 404);
  } catch (error) {
    if (error instanceof Error && ["SCRIPT_PROCESSING_ACTIVE", "SCRIPT_EDIT_CONFLICT"].includes(error.message)) return respostaErro("CONFLICT", "Aguarde o processamento ou recarregue o roteiro antes de editar.", 409);
    if (error instanceof Error && error.message.startsWith("TIMELINE_")) return respostaErro("VALIDATION_ERROR", "A timeline possui tempos inválidos ou sobrepostos.", 400);
    if (error instanceof Error && error.message === "SCRIPT_BLOCK_NOT_FOUND") return respostaErro("VALIDATION_ERROR", "Um bloco não pertence a este roteiro.", 400);
    return tratarExcecao(error, requestId);
  }
}
