import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { salvarArtigoWiki } from "@/repositories/wiki-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = { params: Promise<{ artigoId: string }> };
const artigoSchema = z.object({ resumo: z.string().max(2000), conteudo: z.string().max(30000) }).strict();

export async function PUT(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = await lerJson(request, artigoSchema);
    const artigo = await salvarArtigoWiki(contexto.auth.cliente, validarUuid((await params).artigoId), contexto.auth.usuario.id, entrada.resumo.trim(), entrada.conteudo.trim());
    return artigo ? NextResponse.json({ data: artigo, meta: { requestId } }) : respostaErro("NOT_FOUND", "Artigo não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
