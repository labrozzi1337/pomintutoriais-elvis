import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";
import type { Database } from "@/integrations/supabase/database.types";

type Tabelas = Database["tutoriais"]["Tables"];
type Artigo = Tabelas["wiki_artigos"]["Row"];
type Projeto = Tabelas["projetos"]["Row"];
type Roteiro = Tabelas["roteiros"]["Row"];
type Bloco = Tabelas["blocos"]["Row"];
type Arquivo = Tabelas["arquivos"]["Row"];
type PassoWiki = { id: string; ordem: number; titulo: string; texto: string; inicioMs: number; fimMs: number; topico: string };
type TopicoWiki = { id: string; ordem: number; titulo: string; inicioMs: number; fimMs: number; passos: PassoWiki[] };

export type ArtigoWiki = {
  id: string;
  projetoId: string;
  titulo: string;
  empresa: string;
  area: string;
  resumo: string;
  conteudo: string;
  arquivoVideoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
  passos: PassoWiki[];
  topicos: TopicoWiki[];
};

function tituloCurto(texto: string, indice: number) {
  return texto.trim().split(/[.\n]/u)[0]?.slice(0, 120) || `Parte ${indice + 1}`;
}

function montarPassos(roteiro: Roteiro | undefined, blocos: Bloco[]): { passos: PassoWiki[]; topicos: TopicoWiki[] } {
  if (!roteiro) return { passos: [], topicos: [] };
  const marcadoresBrutos = (roteiro.uso_provedor as { topicos?: unknown } | null)?.topicos;
  const marcadores = Array.isArray(marcadoresBrutos) ? marcadoresBrutos.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { titulo, inicioMs, fimMs } = item as Record<string, unknown>;
    return typeof titulo === "string" && titulo.trim() && typeof inicioMs === "number" && inicioMs >= 0 && typeof fimMs === "number" && fimMs > inicioMs
      ? [{ titulo: titulo.trim(), inicioMs, fimMs }]
      : [];
  }).sort((a, b) => a.inicioMs - b.inicioMs) : [];
  let inicioGrupo = 0;
  let tituloGrupo = "";
  const passos = blocos.filter((bloco) => bloco.roteiro_id === roteiro.id).sort((a, b) => a.ordem - b.ordem).map((bloco, indice) => {
    const marcador = marcadores.find((item) => bloco.inicio_ms >= item.inicioMs && bloco.inicio_ms < item.fimMs)
      ?? [...marcadores].reverse().find((item) => item.inicioMs <= bloco.inicio_ms);
    if (marcador) tituloGrupo = marcador.titulo;
    else if (!tituloGrupo || bloco.inicio_ms - inicioGrupo >= 30_000) {
      inicioGrupo = bloco.inicio_ms;
      tituloGrupo = tituloCurto(bloco.acao_visual, indice);
    }
    return { id: bloco.id, ordem: bloco.ordem, titulo: bloco.acao_visual, texto: bloco.narracao, inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, topico: tituloGrupo };
  });
  const topicos = passos.reduce<TopicoWiki[]>((resultado, passo) => {
    const anterior = resultado.at(-1);
    if (anterior?.titulo === passo.topico) {
      anterior.fimMs = passo.fimMs;
      anterior.passos.push(passo);
    } else resultado.push({ id: passo.id, ordem: resultado.length, titulo: passo.topico, inicioMs: passo.inicioMs, fimMs: passo.fimMs, passos: [passo] });
    return resultado;
  }, []);
  return { passos, topicos };
}

export async function listarWiki(cliente: AuthenticatedSupabaseClient): Promise<ArtigoWiki[]> {
  const { data: artigos, error } = await cliente.from("wiki_artigos").select("*").order("atualizado_em", { ascending: false });
  if (error) throw new Error("WIKI_LIST_FAILED", { cause: error });
  if (!artigos.length) return [];

  const projetosIds = artigos.map((artigo) => artigo.projeto_id);
  const [{ data: projetos, error: projetosError }, { data: roteiros, error: roteirosError }, { data: arquivos, error: arquivosError }] = await Promise.all([
    cliente.from("projetos").select("*").in("id", projetosIds),
    cliente.from("roteiros").select("*").in("projeto_id", projetosIds).neq("status", "substituido"),
    cliente.from("arquivos").select("*").in("projeto_id", projetosIds).eq("tipo", "video_final")
  ]);
  if (projetosError || roteirosError || arquivosError) throw new Error("WIKI_CONTENT_FAILED", { cause: projetosError ?? roteirosError ?? arquivosError });

  const roteirosIds = roteiros.map((roteiro) => roteiro.id);
  const { data: blocos, error: blocosError } = roteirosIds.length
    ? await cliente.from("blocos").select("*").in("roteiro_id", roteirosIds)
    : { data: [] as Bloco[], error: null };
  if (blocosError) throw new Error("WIKI_STEPS_FAILED", { cause: blocosError });
  return montarArtigosWiki(artigos, projetos, roteiros, blocos, arquivos);
}

export async function salvarArtigoWiki(cliente: AuthenticatedSupabaseClient, artigoId: string, usuarioId: string, resumo: string, conteudo: string) {
  const { data, error } = await cliente.from("wiki_artigos").update({ resumo, conteudo, editado_por: usuarioId, atualizado_em: new Date().toISOString() }).eq("id", artigoId).select("id,resumo,conteudo,atualizado_em").maybeSingle();
  if (error) throw new Error("WIKI_UPDATE_FAILED", { cause: error });
  return data;
}

export function montarArtigosWiki(artigos: Artigo[], projetos: Projeto[], roteiros: Roteiro[], blocos: Bloco[], arquivos: Arquivo[]): ArtigoWiki[] {
  const projetoPorId = new Map(projetos.map((projeto) => [projeto.id, projeto]));
  const roteiroPorProjeto = new Map<string, Roteiro>();
  const videoPorProjeto = new Map<string, Arquivo>();
  for (const roteiro of roteiros) {
    const atual = roteiroPorProjeto.get(roteiro.projeto_id);
    if (!atual || roteiro.versao > atual.versao) roteiroPorProjeto.set(roteiro.projeto_id, roteiro);
  }
  for (const arquivo of arquivos) {
    const atual = videoPorProjeto.get(arquivo.projeto_id);
    if (!atual || arquivo.criado_em > atual.criado_em) videoPorProjeto.set(arquivo.projeto_id, arquivo);
  }

  return artigos.flatMap((artigo) => {
    const projeto = projetoPorId.get(artigo.projeto_id);
    if (!projeto) return [];
    const roteiro = roteiroPorProjeto.get(projeto.id);
    const guia = montarPassos(roteiro, blocos);
    return [{
      id: artigo.id,
      projetoId: projeto.id,
      titulo: projeto.titulo,
      empresa: projeto.empresa,
      area: projeto.setor,
      resumo: artigo.resumo,
      conteudo: artigo.conteudo,
      arquivoVideoId: videoPorProjeto.get(projeto.id)?.id ?? null,
      criadoEm: artigo.criado_em,
      atualizadoEm: artigo.atualizado_em,
      ...guia
    }];
  });
}
