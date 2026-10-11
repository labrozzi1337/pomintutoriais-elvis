import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { hashLauncher } from "@/services/launcher";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const codigo = randomBytes(32).toString("hex");
    const expiraEm = new Date(Date.now() + 300000).toISOString();
    const resultado = await contexto.auth.cliente.from("launcher_pareamentos").insert({ proprietario_id: contexto.auth.usuario.id, token_hash: hashLauncher(codigo), expira_em: expiraEm });
    if (resultado.error) return respostaErro("CONFIGURATION_ERROR", "Execute manualmente a migration do Launcher para habilitar o pareamento.", 503);
    return NextResponse.json({ data: { codigo, expiraEm } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
