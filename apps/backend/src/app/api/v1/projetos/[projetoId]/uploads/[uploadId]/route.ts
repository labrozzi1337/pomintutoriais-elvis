import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ projetoId: string; uploadId: string }> };

/** Recebe uma parte sequencial do MP4 sem materializar o arquivo em memória. */
export async function PUT(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const ids = await params;
    const projetoId = validarUuid(ids.projetoId);
    const uploadId = validarUuid(ids.uploadId);
    const armazenamento = new ArmazenamentoLocal(contexto.env.START_BACK_STORAGE_ROOT);
    const manifesto = await armazenamento.obterUpload(contexto.auth.usuario.id, uploadId);
    if (!manifesto || manifesto.projetoId !== projetoId) return respostaErro("NOT_FOUND", "Upload não encontrado.", 404);
    if (manifesto.videoId) return respostaErro("CONFLICT", "Upload já concluído.", 409);
    const tamanho = Number(request.headers.get("content-length"));
    if (!request.body || !Number.isInteger(tamanho) || tamanho <= 0 || tamanho > contexto.env.START_BACK_UPLOAD_CHUNK_BYTES) return respostaErro("UPLOAD_INVALID", "Parte inválida.", 400);
    if (manifesto.bytesRecebidos + tamanho > manifesto.tamanhoEsperado) return respostaErro("UPLOAD_INVALID", "A parte excede o tamanho declarado.", 400);
    const atualizado = await armazenamento.escreverParte(manifesto, request.body, tamanho);
    return NextResponse.json({ data: { uploadId, bytesRecebidos: atualizado.bytesRecebidos, tamanhoBytes: atualizado.tamanhoEsperado }, meta: { requestId } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return respostaErro("CONFLICT", "Outra parte está sendo recebida.", 409);
    return tratarExcecao(error, requestId);
  }
}
