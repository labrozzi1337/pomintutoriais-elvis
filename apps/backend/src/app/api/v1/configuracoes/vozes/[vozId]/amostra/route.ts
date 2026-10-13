import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { garantirVozesConfiguradas } from "@/repositories/narracao-repository";
import { ProvedorFishAudio } from "@/services/fish-audio";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEXTO_AMOSTRA = "Olá, eu sou a voz de exemplo do Pomin Tutoriais. Assim você pode avaliar o ritmo e o tom da narração.";

/** Gera uma prévia curta sem expor a referência privada da voz ao navegador. */
export async function POST(request: Request, contextoRota: { params: Promise<{ vozId: string }> }): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let pasta: string | null = null;
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    if (!contexto.env.FISH_API_KEY) return respostaErro("CONFIGURATION_ERROR", "A voz não está configurada no servidor.", 503);
    await garantirVozesConfiguradas(createServerSupabaseClient(contexto.env), contexto.env.FISH_VOICE_ID_PRIMARY, contexto.env.FISH_VOICE_ID, contexto.env.START_BACK_FISH_MODEL);
    const vozId = validarUuid((await contextoRota.params).vozId);
    const { data: voz, error } = await contexto.auth.cliente.from("vozes").select("referencia_externa,modelo").eq("id", vozId).eq("ativa", true).maybeSingle();
    if (error) throw new Error("VOICE_GET_FAILED", { cause: error });
    if (!voz) return respostaErro("NOT_FOUND", "Voz indisponível.", 404);
    pasta = await mkdtemp(path.join(tmpdir(), "pomin-voz-"));
    const destino = path.join(pasta, "amostra.mp3");
    await new ProvedorFishAudio(contexto.env.FISH_API_KEY).gerar({ texto: TEXTO_AMOSTRA, referenceId: voz.referencia_externa, destino, configuracao: { modelo: contexto.env.START_BACK_FISH_MODEL } });
    const audio = await readFile(destino);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) { return tratarExcecao(error, requestId); }
  finally { if (pasta) await rm(pasta, { recursive: true, force: true }); }
}
