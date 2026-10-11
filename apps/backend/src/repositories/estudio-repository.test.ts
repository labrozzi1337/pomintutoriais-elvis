import { expect, it } from "vitest";
import { atualizarProjeto, excluirProjeto, registrarThumbnail } from "./estudio-repository";

it("não encaminha para exclusão física caminho forjado de outro projeto", async () => {
  const valido = { projeto_id: "a", chave_armazenamento: "projetos/a/originais/video.mp4", tipo: "video_original", mime_type: "video/mp4" };
  const tabelas = {
    arquivos: { select: () => ({ eq: () => Promise.resolve({ data: [valido, { ...valido, chave_armazenamento: "projetos/a/../b/originais/video.mp4" }], error: null }) }) },
    projetos: { delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "a" }, error: null }) }) }) }) }
  };
  const cliente = { from: (nome: string) => tabelas[nome as keyof typeof tabelas] } as never;
  expect(await excluirProjeto(cliente, "a")).toEqual([valido.chave_armazenamento]);
});

it("edita os metadados e resolve empresa e área pelos IDs cadastrados", async () => {
  let atualizacao: Record<string, unknown> = {};
  const cliente = { from: (nome: string) => nome === "areas" ? {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "area", empresa_id: "empresa", nome: "Financeiro" }, error: null }) }) })
  } : nome === "empresas" ? {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "empresa", nome: "Pomin" }, error: null }) }) })
  } : {
    update: (valores: Record<string, unknown>) => { atualizacao = valores; return { eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "projeto", ...valores }, error: null }) }) }) }; }
  } } as never;

  await atualizarProjeto(cliente, "projeto", { titulo: "Novo título", descricao: "Descrição", tags: ["compras"], areaId: "area" });
  expect(atualizacao).toMatchObject({ titulo: "Novo título", descricao: "Descrição", tags: ["compras"], empresa: "Pomin", setor: "Financeiro", empresa_id: "empresa", area_id: "area" });
});

it("mantém a capa anterior até registrar a nova e depois remove seu registro", async () => {
  const anterior = { id: "anterior", projeto_id: "a", chave_armazenamento: "projetos/a/thumbnails/anterior.jpg" };
  const nova = { id: "nova", projeto_id: "a", tipo: "thumbnail", chave_armazenamento: "projetos/a/thumbnails/nova.jpg", mime_type: "image/jpeg", tamanho_bytes: 3, hash_sha256: "hash", criado_em: "2026-10-10", excluir_apos: null };
  let removidos: string[] = [];
  const cliente = { from: (nome: string) => nome === "projetos" ? {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "a" }, error: null }) }) })
  } : {
    select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [anterior], error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: nova, error: null }) }) }),
    delete: () => ({ in: (_campo: string, ids: string[]) => { removidos = ids; return Promise.resolve({ error: null }); }, eq: () => Promise.resolve({ error: null }) })
  } } as never;

  const resultado = await registrarThumbnail(cliente, "a", { id: "nova", chave_armazenamento: nova.chave_armazenamento, mime_type: nova.mime_type, tamanho_bytes: nova.tamanho_bytes, hash_sha256: nova.hash_sha256, criado_em: nova.criado_em });
  expect(resultado?.chavesAnteriores).toEqual([anterior.chave_armazenamento]);
  expect(removidos).toEqual([anterior.id]);
});
