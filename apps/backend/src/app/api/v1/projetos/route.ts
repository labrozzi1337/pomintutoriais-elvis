import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, tratarExcecao } from "@/lib/http";
import { criarProjeto, listarProjetos } from "@/repositories/estudio-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const novoProjetoSchema = z.object({
  titulo: z.string().trim().min(1).max(160),
  empresaId: z.string().uuid(),
  areaId: z.string().uuid()
}).strict();

/** Lista os projetos autorizados do usuário atual. */
export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    return NextResponse.json({ data: await listarProjetos(contexto.auth.cliente), meta: { requestId } });
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}

/** Cria um projeto pessoal vazio para receber um MP4. */
export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = await lerJson(request, novoProjetoSchema);
    const projeto = await criarProjeto(contexto.auth.cliente, contexto.auth.usuario.id, entrada.titulo, entrada.empresaId, entrada.areaId);
    return NextResponse.json({ data: projeto, meta: { requestId } }, { status: 201 });
  } catch (error) {
    return tratarExcecao(error, requestId);
  }
}
