import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoGerado } from "@/repositories/estudio-repository";
import { assinarAcesso } from "@/services/acesso-arquivo";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ arquivoId: string }> };

export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = request.body ? await lerJson(request, z.object({ modo: z.enum(["reproduzir", "baixar"]).default("baixar") }).strict()) : { modo: "baixar" as const };
    const arquivoId = validarUuid((await params).arquivoId);
    const arquivo = await obterArquivoGerado(contexto.auth.cliente, arquivoId);
    if (!arquivo) return respostaErro("NOT_FOUND", "Arquivo não encontrado.", 404);
    const token = assinarAcesso({ videoId: arquivoId, usuarioId: contexto.auth.usuario.id, modo: entrada.modo, expiraEm: Date.now() + 300_000 }, contexto.env.START_BACK_DOWNLOAD_SECRET);
    const url = `/api/v1/arquivos/${arquivoId}/conteudo`;
    const response = NextResponse.json({ data: { url, expiraEm: new Date(Date.now() + 300_000).toISOString() }, meta: { requestId } }, { status: 201 });
    const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    response.headers.set("Set-Cookie", `estudio_arquivo=${token}; HttpOnly; SameSite=Strict; Path=${url}; Max-Age=300${secure ? "; Secure" : ""}`);
    return response;
  } catch (error) { return tratarExcecao(error, requestId); }
}
