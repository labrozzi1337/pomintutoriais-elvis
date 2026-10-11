import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterProjeto } from "@/repositories/estudio-repository";
import { ArmazenamentoLocal, normalizarNomeArquivo } from "@/services/armazenamento-arquivos";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ projetoId: string }> };

const uploadSchema = z.object({
  nomeArquivo: z.string().min(1).max(255),
  mimeType: z.literal("video/mp4"),
  tamanhoBytes: z.number().int().positive()
}).strict();

/** Inicia um upload MP4 recuperável e informa o tamanho das partes. */
export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const projetoId = validarUuid((await params).projetoId);
    if (!await obterProjeto(contexto.auth.cliente, projetoId)) return respostaErro("NOT_FOUND", "Projeto não encontrado.", 404);
    const entrada = await lerJson(request, uploadSchema);
    if (entrada.tamanhoBytes > contexto.env.START_BACK_MAX_VIDEO_BYTES) return respostaErro("UPLOAD_INVALID", "O arquivo excede o limite configurado.", 413);
    const nomeOriginal = normalizarNomeArquivo(entrada.nomeArquivo);
    if (!nomeOriginal.toLowerCase().endsWith(".mp4")) return respostaErro("UPLOAD_INVALID", "Envie um arquivo MP4.", 415);
    const uploadId = crypto.randomUUID();
    const armazenamento = new ArmazenamentoLocal(contexto.env.START_BACK_STORAGE_ROOT);
    await armazenamento.iniciarUpload({ id: uploadId, projetoId, usuarioId: contexto.auth.usuario.id, nomeOriginal, mimeType: entrada.mimeType, tamanhoEsperado: entrada.tamanhoBytes, bytesRecebidos: 0 });
    return NextResponse.json({ data: { uploadId, tamanhoParte: contexto.env.START_BACK_UPLOAD_CHUNK_BYTES, bytesRecebidos: 0 }, meta: { requestId } }, { status: 201 });
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
