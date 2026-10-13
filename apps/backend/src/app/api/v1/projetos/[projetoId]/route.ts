import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { atualizarProjeto, excluirProjeto, obterProjeto } from "@/repositories/estudio-repository";
import { ArmazenamentoLocal } from "@/services/armazenamento-arquivos";
import { ArmazenamentoB2, b2Configurada } from "@/services/b2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContextoRota = { params: Promise<{ projetoId: string }> };
const editarSchema = z.object({
  titulo: z.string().trim().min(1).max(160).optional(),
  descricao: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).transform((tags) => [...new Map(tags.map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag])).values()]).optional(),
  areaId: z.string().uuid().optional()
}).strict().refine((entrada) => Object.values(entrada).some((valor) => valor !== undefined), { message: "Informe ao menos um campo para editar." });

/** Consulta um projeto isolado pelo RLS e seus processamentos. */
export async function GET(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const projeto = await obterProjeto(contexto.auth.cliente, validarUuid((await params).projetoId));
    return projeto ? NextResponse.json({ data: projeto, meta: { requestId } }) : respostaErro("NOT_FOUND", "Projeto não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}

/** Edita título, descrição, tags e organização sem aceitar metadados livres indevidos. */
export async function PATCH(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = await lerJson(request, editarSchema);
    const projeto = await atualizarProjeto(contexto.auth.cliente, validarUuid((await params).projetoId), entrada);
    return projeto ? NextResponse.json({ data: projeto, meta: { requestId } }) : respostaErro("NOT_FOUND", "Projeto não encontrado.", 404);
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}

/** Exclui um projeto do proprietário e limpa seus arquivos persistidos. */
export async function DELETE(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (contexto.auth.acesso.tipo !== "admin") return respostaErro("FORBIDDEN", "Apenas administradores podem excluir projetos.", 403);
    const armazenamento = b2Configurada() ? new ArmazenamentoB2() : new ArmazenamentoLocal(contexto.env.START_BACK_STORAGE_ROOT);
    const chaves = await excluirProjeto(createServerSupabaseClient(contexto.env), validarUuid((await params).projetoId));
    if (!chaves) return respostaErro("NOT_FOUND", "Projeto não encontrado.", 404);
    await Promise.all(chaves.map((chave) => armazenamento.excluir(chave)));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
