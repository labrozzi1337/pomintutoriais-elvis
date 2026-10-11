import { NextResponse } from "next/server";
import { z } from "zod";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, tratarExcecao } from "@/lib/http";
import { listarRecordes, registrarRecorde } from "@/repositories/recordes-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const recordeSchema = z.object({ nickname: z.string().trim().min(1).max(10), score: z.number().int().min(0).max(1_000_000) }).strict();

export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    return NextResponse.json({ data: await listarRecordes(contexto.auth.cliente), meta: { requestId } });
  } catch (error) { return tratarExcecao(error, requestId); }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = await lerJson(request, recordeSchema);
    return NextResponse.json({ data: await registrarRecorde(contexto.auth.cliente, contexto.auth.usuario.id, entrada.nickname, entrada.score), meta: { requestId } }, { status: 201 });
  } catch (error) { return tratarExcecao(error, requestId); }
}
