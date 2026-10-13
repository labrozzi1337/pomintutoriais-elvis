import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { obterContextoApi } from "@/lib/api-context";
import { lerJson, respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { vincularJob } from "@/repositories/estudio-repository";
import { garantirVozesConfiguradas } from "@/repositories/narracao-repository";
import { criarAnalise } from "@/repositories/roteiro-repository";
import { enfileirarAnaliseVideo } from "@/services/fila-processamentos";

export const runtime = "nodejs";
type ContextoRota = { params: Promise<{ videoId: string }> };
const entradaSchema = z.object({
  confirmarSubstituicao: z.boolean().default(false),
  modelo: z.enum(["gpt-6.1-sol", "gpt-6-astra"]).optional(),
  tom: z.enum(["natural", "conversado"]).default("conversado"),
  confirmarCustos: z.literal(true),
  narrarAoConcluir: z.boolean().default(false)
}).strict();

/** Solicita análise assíncrona de um vídeo autorizado e retorna o processamento persistido. */
export async function POST(request: Request, { params }: ContextoRota): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (!contexto.env.OPENAI_API_KEY) return respostaErro("CONFIGURATION_ERROR", "Configure OPENAI_API_KEY no servidor para gerar o roteiro.", 503);
    const entrada = await lerJson(request, entradaSchema);
    let narracao;
    if (entrada.narrarAoConcluir) {
      if (!contexto.env.FISH_API_KEY || (!contexto.env.FISH_VOICE_ID_PRIMARY && !contexto.env.FISH_VOICE_ID)) return respostaErro("CONFIGURATION_ERROR", "Configure a voz padrão no servidor para gerar o tutorial completo.", 503);
      const { padrao } = await garantirVozesConfiguradas(createServerSupabaseClient(contexto.env), contexto.env.FISH_VOICE_ID_PRIMARY, contexto.env.FISH_VOICE_ID, contexto.env.START_BACK_FISH_MODEL);
      if (!padrao) return respostaErro("CONFIGURATION_ERROR", "Configure a voz padrão no servidor para gerar o tutorial completo.", 503);
      narracao = { vozId: padrao.id, modelo: contexto.env.START_BACK_FISH_MODEL, modoAudio: "substituir" as const, ajustarTextoAutomaticamente: true, gerarLegendas: true, fluxoAutomatico: true };
    }
    const processamento = await criarAnalise(contexto.auth.cliente, validarUuid((await params).videoId), contexto.auth.usuario.id, entrada.confirmarSubstituicao, { modelo: contexto.env.START_BACK_OPENAI_MODEL, tom: entrada.tom, narracao });
    if (!processamento) return respostaErro("NOT_FOUND", "Vídeo não encontrado.", 404);
    const jobId = await enfileirarAnaliseVideo(contexto.env, processamento.id);
    await vincularJob(contexto.auth.cliente, processamento.id, jobId);
    return NextResponse.json({ data: { ...processamento, job_id: jobId }, meta: { requestId } }, { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message === "VIDEO_NOT_READY") return respostaErro("CONFLICT", "Aguarde a validação do vídeo.", 409);
    if (error instanceof Error && error.message === "ANALYSIS_ALREADY_ACTIVE") return respostaErro("CONFLICT", "Já existe uma análise ativa para este vídeo.", 409);
    if (error instanceof Error && error.message === "SCRIPT_REPLACEMENT_CONFIRMATION_REQUIRED") return respostaErro("CONFLICT", "O roteiro possui edições humanas. Confirme a substituição para continuar.", 409, { confirmationRequired: true });
    return tratarExcecao(error, requestId);
  }
}
