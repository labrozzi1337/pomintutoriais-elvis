import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterRoteiroAtual } from "@/repositories/roteiro-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ContextoRota = { params: Promise<{ projetoId: string }> };

/** Retorna a versão atual do roteiro e seus blocos cronológicos. */
export async function GET(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const roteiro = await obterRoteiroAtual(contexto.auth.cliente, validarUuid((await params).projetoId));
    return roteiro ? NextResponse.json({ data: roteiro, meta: { requestId } }) : respostaErro("NOT_FOUND", "Roteiro não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
