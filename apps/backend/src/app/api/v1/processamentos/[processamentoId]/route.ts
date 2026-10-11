import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterProcessamento, solicitarCancelamento } from "@/repositories/estudio-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ContextoRota = { params: Promise<{ processamentoId: string }> };

/** Retorna o estado persistido do processamento autorizado. */
export async function GET(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const data = await obterProcessamento(contexto.auth.cliente, validarUuid((await params).processamentoId));
    return data ? NextResponse.json({ data, meta: { requestId } }) : respostaErro("NOT_FOUND", "Processamento não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}

/** Solicita cancelamento idempotente sem encerrar processos de outro projeto. */
export async function DELETE(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const data = await solicitarCancelamento(contexto.auth.cliente, validarUuid((await params).processamentoId));
    return data ? NextResponse.json({ data, meta: { requestId } }) : respostaErro("NOT_FOUND", "Processamento não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
