import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoDoVideo } from "@/repositories/estudio-repository";
import { assinarAcesso } from "@/services/acesso-arquivo";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ videoId: string }> };
const acessoSchema = z.object({ modo: z.enum(["reproduzir", "baixar"]) }).strict();

/** Emite uma URL curta de reprodução/download somente após checar RLS. */
export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const videoId = validarUuid((await params).videoId);
    const entrada = await lerJson(request, acessoSchema);
    const recurso = await obterArquivoDoVideo(contexto.auth.cliente, videoId);
    if (!recurso) return respostaErro("NOT_FOUND", "Vídeo não encontrado.", 404);
    if (recurso.video.status !== "pronto") return respostaErro("CONFLICT", "Aguarde a validação do vídeo.", 409);
    const token = assinarAcesso({ videoId, usuarioId: contexto.auth.usuario.id, modo: entrada.modo, expiraEm: Date.now() + 300_000 }, contexto.env.START_BACK_DOWNLOAD_SECRET);
    const url = `/api/v1/videos/${videoId}/conteudo`;
    const response = NextResponse.json({ data: { url, expiraEm: new Date(Date.now() + 300_000).toISOString() }, meta: { requestId } }, { status: 201 });
    const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    response.headers.set("Set-Cookie", `estudio_acesso=${token}; HttpOnly; SameSite=Strict; Path=${url}; Max-Age=300${secure ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
