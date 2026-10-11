import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoDoVideo, obterProjeto, registrarVideo, vincularJob } from "@/repositories/estudio-repository";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";
import { enfileirarValidacaoVideo } from "@/services/fila-processamentos";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ projetoId: string; uploadId: string }> };

/** Finaliza o upload, persiste metadados e agenda a validação real no worker. */
export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
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
    if (manifesto.bytesRecebidos !== manifesto.tamanhoEsperado) return respostaErro("CONFLICT", "O upload ainda não terminou.", 409);
    let processamento: Awaited<ReturnType<typeof registrarVideo>> | undefined;
    if (manifesto.videoId) {
      const existente = await obterArquivoDoVideo(contexto.auth.cliente, manifesto.videoId);
      if (existente) {
        const projeto = await obterProjeto(contexto.auth.cliente, projetoId);
        processamento = projeto?.processamentos.find((item) => item.video_id === manifesto.videoId && item.tipo === "validar_video");
        if (!processamento) return respostaErro("CONFLICT", "O vídeo existe, mas sua validação não foi encontrada.", 409);
      }
    }
    const videoId = manifesto.videoId ?? crypto.randomUUID();
    if (!processamento) {
      const promovido = await armazenamento.promoverUpload(manifesto, videoId);
      processamento = await registrarVideo(contexto.auth.cliente, {
        projetoId, videoId, arquivoId: crypto.randomUUID(), processamentoId: crypto.randomUUID(), nomeOriginal: manifesto.nomeOriginal, mimeType: manifesto.mimeType,
        tamanhoBytes: manifesto.tamanhoEsperado, chaveArmazenamento: promovido.chave, hashSha256: promovido.hashSha256
      });
    }
    try {
      const jobId = await enfileirarValidacaoVideo(contexto.env, processamento.id);
      await vincularJob(contexto.auth.cliente, processamento.id, jobId);
    } catch {
      return respostaErro("SERVICE_UNAVAILABLE", "O envio terminou, mas o processamento está indisponível. Tente novamente.", 503);
    }
    return NextResponse.json({ data: { videoId, processamentoId: processamento.id, status: processamento.status }, meta: { requestId } }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_NOT_MP4") return respostaErro("UPLOAD_INVALID", "O conteúdo enviado não é um MP4 válido.", 415);
    return tratarExcecao(error, requestId);
  }
}
