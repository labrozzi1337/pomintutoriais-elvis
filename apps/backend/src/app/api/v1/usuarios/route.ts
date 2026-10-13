import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { criarUsuario, listarUsuarios } from "@/services/administracao-usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const novoUsuarioSchema = z.object({
  email: z.string().email().max(254),
  nome: z.string().trim().max(120).optional(),
  tipo: z.enum(["comum", "admin"]),
  metodo: z.enum(["local", "microsoft"]),
  senha: z.string().min(8).max(72).optional()
}).strict().refine((entrada) => entrada.metodo === "microsoft" || Boolean(entrada.senha), { path: ["senha"], message: "Informe uma senha com pelo menos 8 caracteres." });

export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const administrador = contexto.auth.acesso.tipo === "admin";
    const todos = administrador ? await listarUsuarios(createServerSupabaseClient(contexto.env)) : [];
    return NextResponse.json({ data: { administrador, usuarioAtualId: contexto.auth.acesso.id, usuarios: todos.filter((usuario) => usuario.status === "ativo"), bloqueados: todos.filter((usuario) => usuario.status === "bloqueado") }, meta: { requestId } });
  } catch (error) { return tratarExcecao(error, requestId); }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (contexto.auth.acesso.tipo !== "admin") return respostaErro("FORBIDDEN", "Apenas administradores podem criar usuários.", 403);
    const entrada = await lerJson(request, novoUsuarioSchema);
    const usuario = await criarUsuario(createServerSupabaseClient(contexto.env), entrada);
    return NextResponse.json({ data: usuario, meta: { requestId } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_ALREADY_EXISTS") return respostaErro("CONFLICT", "Este e-mail já está liberado.", 409);
    return tratarExcecao(error, requestId);
  }
}
