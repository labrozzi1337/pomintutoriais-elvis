import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { criarProcessamentoNarracao, garantirVozesConfiguradas } from "@/repositories/narracao-repository";
import { vincularJob } from "@/repositories/estudio-repository";
import { enfileirarNarracao } from "@/services/fila-processamentos";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ roteiroId: string }> };
const entradaSchema = z.object({
  modoAudio: z.enum(["substituir", "ducking", "manter_original"]).default("substituir"),
  confirmarCustos: z.literal(true),
  blocoId: z.uuid().optional(),
  regenerarTudo: z.boolean().default(false),
  vozId: z.uuid().optional(),
  ajustarTextoAutomaticamente: z.boolean().default(false),
  gerarLegendas: z.boolean().default(true)
}).strict();

/** Agenda voz e renderização após confirmação explícita de chamadas pagas. */
export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (!contexto.env.FISH_API_KEY || (!contexto.env.FISH_VOICE_ID_PRIMARY && !contexto.env.FISH_VOICE_ID)) return respostaErro("CONFIGURATION_ERROR", "Configure a voz no servidor.", 503);
    const entrada = await lerJson(request, entradaSchema);
    const roteiroId = validarUuid((await params).roteiroId);
    const { padrao } = await garantirVozesConfiguradas(createServerSupabaseClient(contexto.env), contexto.env.FISH_VOICE_ID_PRIMARY, contexto.env.FISH_VOICE_ID, contexto.env.START_BACK_FISH_MODEL);
    if (!padrao) return respostaErro("CONFIGURATION_ERROR", "Configure a voz no servidor.", 503);
    const selecao = entrada.vozId ? await contexto.auth.cliente.from("vozes").select("*").eq("id", entrada.vozId).eq("ativa", true).maybeSingle() : { data: padrao, error: null };
    if (selecao.error) throw new Error("VOICE_GET_FAILED", { cause: selecao.error });
    if (!selecao.data) return respostaErro("NOT_FOUND", "Voz indisponível.", 404);
    const voz = selecao.data;
    if (entrada.blocoId) {
      const bloco = await contexto.auth.cliente.from("blocos").select("id").eq("id", entrada.blocoId).eq("roteiro_id", roteiroId).maybeSingle();
      if (!bloco.data) return respostaErro("NOT_FOUND", "Bloco não encontrado neste roteiro.", 404);
    }
    const processamento = await criarProcessamentoNarracao(contexto.auth.cliente, {
      roteiroId, vozId: voz.id, modelo: contexto.env.START_BACK_FISH_MODEL, modoAudio: entrada.modoAudio,
      forcarBlocoId: entrada.blocoId, forcarTodos: entrada.regenerarTudo,
      ajustarTextoAutomaticamente: entrada.ajustarTextoAutomaticamente, gerarLegendas: entrada.gerarLegendas
    });
    if (!processamento) return respostaErro("NOT_FOUND", "Roteiro não encontrado.", 404);
    const jobId = await enfileirarNarracao(contexto.env, processamento.id);
    await vincularJob(contexto.auth.cliente, processamento.id, jobId);
    return NextResponse.json({ data: { ...processamento, job_id: jobId }, meta: { requestId } }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "NARRATION_ALREADY_ACTIVE") return respostaErro("CONFLICT", "Já existe uma narração ativa para este vídeo.", 409);
    if (error instanceof Error && error.message === "VIDEO_NOT_READY") return respostaErro("CONFLICT", "O vídeo ainda não está pronto.", 409);
    return tratarExcecao(error, requestId);
  }
}
