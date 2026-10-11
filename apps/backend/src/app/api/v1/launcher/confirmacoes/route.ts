import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { hashLauncher, retornoLauncherValido } from "@/services/launcher";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  try {
    const env = getServerEnv();
    if (!env.ok) return respostaErro("CONFIGURATION_ERROR", "Servidor indisponível.", 503);
    const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return respostaErro("AUTH_REQUIRED", "Launcher não autorizado.", 401);
    const id = z.uuid().parse(new URL(request.url).searchParams.get("desafio"));
    const cliente = createServerSupabaseClient(env.data);
    const dispositivo = await cliente.from("launcher_dispositivos").select("id,proprietario_id,ativo").eq("token_hash", hashLauncher(token)).eq("ativo", true).maybeSingle();
    if (dispositivo.error || !dispositivo.data) return respostaErro("AUTH_REQUIRED", "Launcher revogado ou desconhecido.", 401);
    const desafio = await cliente.from("launcher_desafios").select("*").eq("id", id).maybeSingle();
    if (desafio.error || !desafio.data || !retornoLauncherValido(desafio.data, dispositivo.data)) return respostaErro("AUTH_REQUIRED", "Desafio inválido, expirado ou já utilizado.", 401);
    return NextResponse.json({ data: { id } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const env = getServerEnv();
    if (!env.ok) return respostaErro("CONFIGURATION_ERROR", "Servidor indisponível.", 503);
    const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!token) return respostaErro("AUTH_REQUIRED", "Launcher não autorizado.", 401);
    const entrada = await lerJson(request, z.object({ desafioId: z.uuid(), status: z.enum(["aberto", "recordly_nao_encontrado", "cancelado", "erro"]) }).strict());
    const cliente = createServerSupabaseClient(env.data);
    const dispositivo = await cliente.from("launcher_dispositivos").select("id,proprietario_id,ativo").eq("token_hash", hashLauncher(token)).eq("ativo", true).maybeSingle();
    if (dispositivo.error || !dispositivo.data) return respostaErro("AUTH_REQUIRED", "Launcher revogado ou desconhecido.", 401);
    const desafio = await cliente.from("launcher_desafios").select("*").eq("id", entrada.desafioId).maybeSingle();
    if (desafio.error || !desafio.data || !retornoLauncherValido(desafio.data, dispositivo.data)) return respostaErro("AUTH_REQUIRED", "Desafio inválido, expirado ou já utilizado.", 401);
    const agora = new Date().toISOString();
    const confirmacao = await cliente.from("launcher_desafios").update({ status: entrada.status, respondido_em: agora }).eq("id", entrada.desafioId).eq("status", "aguardando").eq("dispositivo_id", dispositivo.data.id).gt("expira_em", agora).select("id").maybeSingle();
    if (confirmacao.error || !confirmacao.data) return respostaErro("CONFLICT", "Desafio já respondido.", 409);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
