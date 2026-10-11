import { NextResponse } from "next/server";
import { obterContextoApi } from "@/lib/api-context";
import { tratarExcecao } from "@/lib/http";
import { garantirVozesConfiguradas } from "@/repositories/narracao-repository";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const vozes = await garantirVozesConfiguradas(createServerSupabaseClient(contexto.env), contexto.env.FISH_VOICE_ID_PRIMARY, contexto.env.FISH_VOICE_ID, contexto.env.START_BACK_FISH_MODEL);
    return NextResponse.json({ data: { vozes: vozes.vozes.map((voz) => ({ id: voz.id, nome: voz.nome, padrao: voz.id === vozes.padrao?.id })), vozPadraoId: vozes.padrao?.id ?? null, limiteBytes: contexto.env.START_BACK_MAX_VIDEO_BYTES, limiteDuracaoMs: contexto.env.START_BACK_MAX_VIDEO_DURATION_MS, modeloPadrao: contexto.env.START_BACK_OPENAI_MODEL, retencao: "Projetos mantidos até exclusão pelo proprietário." } });
  } catch (error) { return tratarExcecao(error, requestId); }
}
