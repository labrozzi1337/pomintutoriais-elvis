import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { obterArquivoInterno } from "@/repositories/estudio-repository";
import { validarAcesso } from "@/services/acesso-arquivo";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";
import { interpretarRange } from "@/services/http-range";
import { ArmazenamentoB2, b2Configurada } from "@/services/b2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ContextoRota = { params: Promise<{ videoId: string }> };

/** Transmite o MP4 com Range após validar um token curto vinculado ao vídeo. */
export async function GET(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const env = getServerEnv();
    if (!env.ok) return respostaErro("CONFIGURATION_ERROR", "O servidor não está configurado.", 503);
    const videoId = validarUuid((await params).videoId);
    const token = lerCookie(request.headers.get("cookie"), "estudio_acesso") ?? "";
    const acesso = validarAcesso(token, videoId, env.data.START_BACK_DOWNLOAD_SECRET);
    if (!acesso) return respostaErro("AUTH_REQUIRED", "O acesso expirou ou é inválido.", 401);
    const recurso = await obterArquivoInterno(createServerSupabaseClient(env.data), videoId);
    if (!recurso || recurso.video.status !== "pronto") return respostaErro("NOT_FOUND", "Vídeo não encontrado.", 404);
    if (b2Configurada()) {
      const url = await new ArmazenamentoB2().url(recurso.arquivo.chave_armazenamento, "video/mp4", acesso.modo === "baixar" ? recurso.video.nome_original : undefined);
      return new Response(null, { status: 307, headers: { Location: url, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
    const caminho = new ArmazenamentoLocal(env.data.START_BACK_STORAGE_ROOT).caminhoAbsoluto(recurso.arquivo.chave_armazenamento);
    const tamanho = (await stat(caminho)).size;
    const intervalo = interpretarRange(request.headers.get("range"), tamanho);
    if (intervalo === "invalido") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${tamanho}` } });
    const inicio = intervalo?.inicio ?? 0;
    const fim = intervalo?.fim ?? tamanho - 1;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
      "Content-Length": String(fim - inicio + 1),
      "Cache-Control": "private, no-store"
    });
    if (intervalo) headers.set("Content-Range", `bytes ${inicio}-${fim}/${tamanho}`);
    if (acesso.modo === "baixar") headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(recurso.video.nome_original)}`);
    const stream = Readable.toWeb(createReadStream(caminho, { start: inicio, end: fim })) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: intervalo ? 206 : 200, headers });
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}

/** Lê um cookie específico sem aceitar nomes parciais ou decodificação ambígua. */
function lerCookie(header: string | null, nome: string): string | null {
  if (!header) return null;
  for (const item of header.split(";")) {
    const [chave, ...valor] = item.trim().split("=");
    if (chave === nome) return valor.join("=");
  }
  return null;
}
