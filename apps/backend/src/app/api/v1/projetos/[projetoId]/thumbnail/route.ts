import { createHash } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { registrarThumbnail } from "@/repositories/estudio-repository";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";
import { ArmazenamentoB2, b2Configurada } from "@/services/b2";

export const runtime = "nodejs";
const LIMITE_CAPA = 2 * 1024 * 1024;
type ContextoRota = { params: Promise<{ projetoId: string }> };

export async function PUT(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let chave = "";
  let armazenamento: ArmazenamentoLocal | ArmazenamentoB2 | null = null;
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (request.headers.get("content-type")?.split(";")[0] !== "image/jpeg") return respostaErro("UPLOAD_INVALID", "Envie a miniatura em JPG.", 415);
    const tamanhoInformado = Number(request.headers.get("content-length") ?? 0);
    if (tamanhoInformado > LIMITE_CAPA) return respostaErro("UPLOAD_INVALID", "A miniatura deve ter no máximo 2 MB.", 413);
    const dados = new Uint8Array(await request.arrayBuffer());
    if (!dados.length || dados.length > LIMITE_CAPA || dados[0] !== 0xff || dados[1] !== 0xd8 || dados[2] !== 0xff) return respostaErro("UPLOAD_INVALID", "A miniatura JPG é inválida.", 400);
    const projetoId = validarUuid((await params).projetoId);
    const id = crypto.randomUUID();
    chave = path.posix.join("projetos", projetoId, "thumbnails", `${id}.jpg`);
    armazenamento = b2Configurada() ? new ArmazenamentoB2() : new ArmazenamentoLocal(contexto.env.START_BACK_STORAGE_ROOT);
    await armazenamento.salvar(chave, dados);
    const resultado = await registrarThumbnail(contexto.auth.cliente, projetoId, { id, chave_armazenamento: chave, mime_type: "image/jpeg", tamanho_bytes: dados.length, hash_sha256: createHash("sha256").update(dados).digest("hex"), criado_em: new Date().toISOString() });
    if (!resultado) { await armazenamento.excluir(chave); return respostaErro("NOT_FOUND", "Projeto não encontrado.", 404); }
    chave = "";
    await Promise.allSettled(resultado.chavesAnteriores.map((anterior) => armazenamento!.excluir(anterior)));
    return NextResponse.json({ data: { id: resultado.arquivo.id }, meta: { requestId } });
  } catch (error) {
    if (chave && armazenamento) await armazenamento.excluir(chave).catch(() => undefined);
    return tratarExcecao(error, requestId);
  }
}
