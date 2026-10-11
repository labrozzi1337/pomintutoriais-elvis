import { expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/database.types";
import { montarArtigosWiki } from "./wiki-repository";

type Tabelas = Database["tutoriais"]["Tables"];

it("publica o vídeo final mais novo com os passos da versão atual do roteiro", () => {
  const artigo = { id: "artigo", projeto_id: "projeto", resumo: "Resumo", conteudo: "Texto", editado_por: null, criado_em: "2026-01-01", atualizado_em: "2026-01-01" } as Tabelas["wiki_artigos"]["Row"];
  const projeto = { id: "projeto", titulo: "Compras", empresa: "Pomin", setor: "Financeiro" } as Tabelas["projetos"]["Row"];
  const roteiros = [{ id: "antigo", projeto_id: "projeto", versao: 1 }, { id: "atual", projeto_id: "projeto", versao: 2, uso_provedor: { topicos: [{ titulo: "Fazer uma compra", inicioMs: 0, fimMs: 20_000 }] } }] as unknown as Tabelas["roteiros"]["Row"][];
  const blocos = [{ id: "2", roteiro_id: "atual", ordem: 1, inicio_ms: 8_000, fim_ms: 15_000, acao_visual: "Confirmar", narracao: "Confirme a compra." }, { id: "1", roteiro_id: "atual", ordem: 0, inicio_ms: 0, fim_ms: 8_000, acao_visual: "Abrir", narracao: "Abra a área." }, { id: "velho", roteiro_id: "antigo", ordem: 0, inicio_ms: 0, fim_ms: 5_000, acao_visual: "Ignorar", narracao: "Versão antiga." }] as Tabelas["blocos"]["Row"][];
  const arquivos = [{ id: "video-antigo", projeto_id: "projeto", criado_em: "2026-01-01" }, { id: "video-atual", projeto_id: "projeto", criado_em: "2026-01-02" }] as Tabelas["arquivos"]["Row"][];

  expect(montarArtigosWiki([artigo], [projeto], roteiros, blocos, arquivos)[0]).toMatchObject({
    titulo: "Compras", arquivoVideoId: "video-atual", passos: [{ titulo: "Abrir", inicioMs: 0, topico: "Fazer uma compra" }, { titulo: "Confirmar", inicioMs: 8_000, topico: "Fazer uma compra" }],
    topicos: [{ titulo: "Fazer uma compra", inicioMs: 0, fimMs: 15_000, passos: [{ titulo: "Abrir" }, { titulo: "Confirmar" }] }]
  });
});

it("agrupa etapas curtas de roteiros antigos em vez de criar um tópico por clique", () => {
  const artigo = { id: "artigo", projeto_id: "projeto", resumo: "", conteudo: "", criado_em: "2026-01-01", atualizado_em: "2026-01-01" } as Tabelas["wiki_artigos"]["Row"];
  const projeto = { id: "projeto", titulo: "Login", empresa: "Pomin", setor: "TI" } as Tabelas["projetos"]["Row"];
  const roteiro = { id: "roteiro", projeto_id: "projeto", versao: 1, uso_provedor: null } as Tabelas["roteiros"]["Row"];
  const blocos = [0, 1, 2].map((ordem) => ({ id: `${ordem}`, roteiro_id: "roteiro", ordem, inicio_ms: ordem * 5_000, fim_ms: (ordem + 1) * 5_000, acao_visual: ordem ? `Clique ${ordem}` : "Entrar no sistema.", narracao: "Faça a ação." })) as Tabelas["blocos"]["Row"][];
  const resultado = montarArtigosWiki([artigo], [projeto], [roteiro], blocos, [] as Tabelas["arquivos"]["Row"][])[0];
  expect(resultado?.topicos).toHaveLength(1);
  expect(resultado?.topicos[0]).toMatchObject({ titulo: "Entrar no sistema", inicioMs: 0, fimMs: 15_000 });
});
