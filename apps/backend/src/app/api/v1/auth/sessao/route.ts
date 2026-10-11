import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { tratarExcecao } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    return NextResponse.json({ data: { email: contexto.auth.acesso.email, tipo: contexto.auth.acesso.tipo }, meta: { requestId } });
  } catch (error) { return tratarExcecao(error, requestId); }
}
