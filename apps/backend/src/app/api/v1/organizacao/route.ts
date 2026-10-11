import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, tratarExcecao } from "@/lib/http";
import { criarArea, criarEmpresa, listarOrganizacao } from "@/repositories/organizacao-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entradaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("empresa"), nome: z.string().trim().min(1).max(120) }).strict(),
  z.object({ tipo: z.literal("area"), empresaId: z.string().uuid(), nome: z.string().trim().min(1).max(120) }).strict()
]);

export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    return NextResponse.json({ data: await listarOrganizacao(contexto.auth.cliente), meta: { requestId } });
  } catch (error) { return tratarExcecao(error, requestId); }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = await lerJson(request, entradaSchema);
    const data = entrada.tipo === "empresa"
      ? await criarEmpresa(contexto.auth.cliente, contexto.auth.usuario.id, entrada.nome)
      : await criarArea(contexto.auth.cliente, contexto.auth.usuario.id, entrada.empresaId, entrada.nome);
    return NextResponse.json({ data, meta: { requestId } }, { status: 201 });
  } catch (error) { return tratarExcecao(error, requestId); }
}
