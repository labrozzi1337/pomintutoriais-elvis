import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { z } from "zod";
import { hashLauncher } from "@/services/launcher";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const entrada = request.body ? await lerJson(request, z.object({ dispositivoId: z.uuid().optional() }).strict()) : {};
    let consulta = contexto.auth.cliente.from("launcher_dispositivos").select("id").eq("ativo", true);
    if (entrada.dispositivoId) consulta = consulta.eq("id", entrada.dispositivoId);
    const dispositivo = await consulta.order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (dispositivo.error || !dispositivo.data) return respostaErro("CONFIGURATION_ERROR", "Instale e pareie a integração Windows antes de abrir o Recordly.", 503);
    const resultado = await contexto.auth.cliente.from("launcher_desafios").insert({ proprietario_id: contexto.auth.usuario.id, dispositivo_id: dispositivo.data.id, sessao_hash: hashLauncher(request.headers.get("authorization") ?? ""), expira_em: new Date(Date.now() + 60000).toISOString() }).select("id,expira_em").single();
    if (resultado.error) throw new Error("LAUNCHER_CHALLENGE_FAILED");
    return NextResponse.json({ data: { id: resultado.data.id, expiraEm: resultado.data.expira_em, url: `estudiotutoriais://abrir?desafio=${resultado.data.id}` } }, { status: 201 });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
