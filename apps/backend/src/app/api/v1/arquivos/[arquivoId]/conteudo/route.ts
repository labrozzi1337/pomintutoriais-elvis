import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoGeradoInterno } from "@/repositories/estudio-repository";
import { validarAcesso } from "@/services/acesso-arquivo";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";
import { interpretarRange } from "@/services/http-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ContextoRota = { params: Promise<{ arquivoId: string }> };

export async function GET(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const env = getServerEnv();
    if (!env.ok) return respostaErro("CONFIGURATION_ERROR", "O servidor não está configurado.", 503);
    const arquivoId = validarUuid((await params).arquivoId);
    const nomeCookie = "estudio_arquivo=";
    const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(nomeCookie))?.slice(nomeCookie.length) ?? "";
    const acesso = validarAcesso(cookie, arquivoId, env.data.START_BACK_DOWNLOAD_SECRET);
    if (!acesso) return respostaErro("AUTH_REQUIRED", "O acesso expirou ou é inválido.", 401);
    const arquivo = await obterArquivoGeradoInterno(createServerSupabaseClient(env.data), arquivoId);
    if (!arquivo) return respostaErro("NOT_FOUND", "Arquivo não encontrado.", 404);
    const caminho = new ArmazenamentoLocal(env.data.START_BACK_STORAGE_ROOT).caminhoAbsoluto(arquivo.chave_armazenamento);
    const tamanho = (await stat(caminho)).size;
    const intervalo = interpretarRange(request.headers.get("range"), tamanho);
    if (intervalo === "invalido") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${tamanho}` } });
    const inicio = intervalo?.inicio ?? 0, fim = intervalo?.fim ?? tamanho - 1;
    const nome = arquivo.tipo === "thumbnail" ? "miniatura.jpg" : arquivo.tipo === "video_final" ? "tutorial-narrado.mp4" : arquivo.mime_type === "text/vtt" ? "legendas.vtt" : arquivo.mime_type === "application/x-subrip" ? "legendas.srt" : arquivo.mime_type === "audio/wav" ? "narracao.wav" : "narracao.mp3";
    return new Response(Readable.toWeb(createReadStream(caminho, { start: inicio, end: fim })) as ReadableStream<Uint8Array>, { status: intervalo ? 206 : 200, headers: {
      "Accept-Ranges": "bytes", ...(intervalo ? { "Content-Range": `bytes ${inicio}-${fim}/${tamanho}` } : {}),
      "Content-Type": arquivo.mime_type, "Content-Length": String(fim - inicio + 1), ...(acesso.modo === "baixar" ? { "Content-Disposition": `attachment; filename="${nome}"` } : {}), "Cache-Control": "private, no-store"
    } });
  } catch (error) { return tratarExcecao(error, requestId); }
}
