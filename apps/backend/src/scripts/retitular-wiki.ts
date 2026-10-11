import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { gerarTopicosWiki } from "@/services/openai-topicos-wiki";

async function main() {
const configuracao = getServerEnv();
if (!configuracao.ok) throw new Error(`CONFIG_INVALID:${configuracao.issues.join(",")}`);
const env = configuracao.data;
const apiKey = env.OPENAI_API_KEY;
if (!apiKey) throw new Error("CONFIG_INVALID:OPENAI_API_KEY");
const cliente = createServerSupabaseClient(env);

const { data: artigos, error: artigosError } = await cliente.from("wiki_artigos").select("projeto_id");
if (artigosError) throw artigosError;
const projetosIds = [...new Set(artigos.map((artigo) => artigo.projeto_id))];
if (!projetosIds.length) {
  console.log("Nenhum artigo da Wiki encontrado.");
  process.exit(0);
}

const [{ data: projetos, error: projetosError }, { data: roteiros, error: roteirosError }] = await Promise.all([
  cliente.from("projetos").select("id,titulo").in("id", projetosIds),
  cliente.from("roteiros").select("*").in("projeto_id", projetosIds).neq("status", "substituido")
]);
if (projetosError) throw projetosError;
if (roteirosError) throw roteirosError;
const roteiroPorProjeto = new Map<string, (typeof roteiros)[number]>();
for (const roteiro of roteiros) {
  const atual = roteiroPorProjeto.get(roteiro.projeto_id);
  if (!atual || roteiro.versao > atual.versao) roteiroPorProjeto.set(roteiro.projeto_id, roteiro);
}
const roteirosIds = [...roteiroPorProjeto.values()].map((roteiro) => roteiro.id);
const { data: blocos, error: blocosError } = await cliente.from("blocos").select("*").in("roteiro_id", roteirosIds).order("ordem");
if (blocosError) throw blocosError;

let atualizados = 0;
for (const projeto of projetos) {
  const roteiro = roteiroPorProjeto.get(projeto.id);
  if (!roteiro) continue;
  const blocosRoteiro = blocos.filter((bloco) => bloco.roteiro_id === roteiro.id).sort((a, b) => a.ordem - b.ordem);
  if (!blocosRoteiro.length) continue;
  const topicos = await gerarTopicosWiki({
    apiKey,
    modelo: env.START_BACK_OPENAI_MODEL,
    tituloTutorial: projeto.titulo,
    blocos: blocosRoteiro.map((bloco) => ({ inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, acaoVisual: bloco.acao_visual, narracao: bloco.narracao }))
  });
  const usoAtual = roteiro.uso_provedor && typeof roteiro.uso_provedor === "object" && !Array.isArray(roteiro.uso_provedor) ? roteiro.uso_provedor : {};
  const { error } = await cliente.from("roteiros").update({ uso_provedor: { ...usoAtual, topicos, topicosVersao: "wiki-v2-objetivos", topicosAtualizadosEm: new Date().toISOString() } }).eq("id", roteiro.id);
  if (error) throw error;
  atualizados += 1;
  console.log(`Atualizado: ${projeto.titulo} (${topicos.length} tópicos)`);
}
console.log(`Concluído: ${atualizados} artigo(s) atualizado(s).`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
