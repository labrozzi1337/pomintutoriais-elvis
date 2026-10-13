import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { alterarStatusUsuario, alterarTipoUsuario, excluirUsuario } from "@/services/administracao-usuarios";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ usuarioId: string }> };

export async function PATCH(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (contexto.auth.acesso.tipo !== "admin") return respostaErro("FORBIDDEN", "Apenas administradores podem alterar permissões.", 403);
    const entrada = await lerJson(request, z.union([
      z.object({ tipo: z.enum(["comum", "admin"]) }).strict(),
      z.object({ status: z.enum(["ativo", "bloqueado"]) }).strict()
    ]));
    const cliente = createServerSupabaseClient(contexto.env);
    const usuarioId = validarUuid((await params).usuarioId);
    const usuario = "tipo" in entrada
      ? await alterarTipoUsuario(cliente, usuarioId, entrada.tipo, contexto.auth.usuario.id)
      : await alterarStatusUsuario(cliente, usuarioId, entrada.status, contexto.auth.usuario.id);
    return usuario ? NextResponse.json({ data: usuario, meta: { requestId } }) : respostaErro("NOT_FOUND", "Usuário não encontrado.", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_SELF_DEMOTE") return respostaErro("CONFLICT", "Você não pode remover a própria permissão de administrador.", 409);
    if (error instanceof Error && error.message === "USER_SELF_BLOCK") return respostaErro("CONFLICT", "Você não pode bloquear a própria conta.", 409);
    return tratarExcecao(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (contexto.auth.acesso.tipo !== "admin") return respostaErro("FORBIDDEN", "Apenas administradores podem excluir usuários.", 403);
    const excluido = await excluirUsuario(createServerSupabaseClient(contexto.env), validarUuid((await params).usuarioId), contexto.auth.usuario.id);
    return excluido ? new NextResponse(null, { status: 204 }) : respostaErro("NOT_FOUND", "Usuário não encontrado.", 404);
  } catch (error) {
    if (error instanceof Error && error.message === "USER_SELF_DELETE") return respostaErro("CONFLICT", "Você não pode excluir a própria conta.", 409);
    return tratarExcecao(error, requestId);
  }
}
