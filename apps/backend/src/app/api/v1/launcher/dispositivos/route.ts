import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { hashLauncher } from "@/services/launcher";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const resultado = await contexto.auth.cliente.from("launcher_dispositivos").select("id,ativo,criado_em").order("criado_em", { ascending: false });
    if (resultado.error) return respostaErro("CONFIGURATION_ERROR", "A integração Windows ainda aguarda a migration manual.", 503);
    return NextResponse.json({ data: resultado.data });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = getServerEnv();
    if (!env.ok) return respostaErro("CONFIGURATION_ERROR", "Servidor indisponível.", 503);
    const entrada = await lerJson(request, z.object({ codigo: z.string().regex(/^[a-f0-9]{64}$/), tokenDispositivo: z.string().regex(/^[a-f0-9]{64}$/) }).strict());
    const cliente = createServerSupabaseClient(env.data);
    const agora = new Date().toISOString();
    // A capacidade opaca de uso único determina o proprietário; nenhum ID externo é aceito.
    const pareamento = await cliente.from("launcher_pareamentos").update({ consumido_em: agora }).eq("token_hash", hashLauncher(entrada.codigo)).is("consumido_em", null).gt("expira_em", agora).select("proprietario_id").maybeSingle();
    if (pareamento.error || !pareamento.data) return respostaErro("AUTH_REQUIRED", "Código expirado ou já utilizado.", 401);
    const dispositivo = await cliente.from("launcher_dispositivos").insert({ proprietario_id: pareamento.data.proprietario_id, token_hash: hashLauncher(entrada.tokenDispositivo) }).select("id").single();
    if (dispositivo.error) throw new Error("LAUNCHER_PAIRING_FAILED");
    return NextResponse.json({ data: dispositivo.data }, { status: 201 });
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
