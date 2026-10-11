import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { hashLauncher } from "@/services/launcher";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ desafioId: string }> }): Promise<Response> {
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const desafio = await contexto.auth.cliente.from("launcher_desafios").select("status,expira_em").eq("id", validarUuid((await params).desafioId)).eq("sessao_hash", hashLauncher(request.headers.get("authorization") ?? "")).maybeSingle();
    if (desafio.error) throw new Error("LAUNCHER_STATUS_FAILED");
    if (!desafio.data) return respostaErro("NOT_FOUND", "Desafio não pertence a esta sessão.", 404);
    const status = desafio.data.status === "aguardando" && Date.parse(desafio.data.expira_em) < Date.now() ? "nao_respondeu" : desafio.data.status;
    return NextResponse.json({ data: { status } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
