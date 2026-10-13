import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoGerado } from "@/repositories/estudio-repository";
import { assinarAcesso } from "@/services/acesso-arquivo";
import { ArmazenamentoB2, b2Configurada } from "@/services/b2";

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
    if (b2Configurada()) {
      const url = await new ArmazenamentoB2().url(arquivo.chave_armazenamento, arquivo.mime_type, entrada.modo === "baixar" ? arquivo.chave_armazenamento.split("/").at(-1) : undefined);
      return NextResponse.json({ data: { url, expiraEm: new Date(Date.now() + 300_000).toISOString() }, meta: { requestId } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    }
    const token = assinarAcesso({ videoId: arquivoId, usuarioId: contexto.auth.usuario.id, modo: entrada.modo, expiraEm: Date.now() + 300_000 }, contexto.env.START_BACK_DOWNLOAD_SECRET);
    const url = `/api/v1/arquivos/${arquivoId}/conteudo`;
    const response = NextResponse.json({ data: { url, expiraEm: new Date(Date.now() + 300_000).toISOString() }, meta: { requestId } }, { status: 201 });
    const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    response.headers.set("Set-Cookie", `estudio_arquivo=${token}; HttpOnly; SameSite=Strict; Path=${url}; Max-Age=300${secure ? "; Secure" : ""}`);
    return response;
  } catch (error) { return tratarExcecao(error, requestId); }
}
