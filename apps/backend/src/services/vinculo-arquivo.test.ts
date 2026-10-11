import { expect, it } from "vitest";
import { arquivoDoProjeto } from "./vinculo-arquivo";

it("rejeita referência e caminho de outro projeto mesmo dentro da raiz de storage", () => {
  const arquivo = { projeto_id: "a", chave_armazenamento: "projetos/a/render/arquivo.mp4", tipo: "video_final", mime_type: "video/mp4" };
  expect(arquivoDoProjeto("a", arquivo)).toBe(true);
  for (const chave of ["projetos/b/render/arquivo.mp4", "projetos/a/../b/arquivo.mp4", "projetos/a/../../segredo", "projetos/a/..\\b\\arquivo.mp4", "/etc/passwd"]) expect(arquivoDoProjeto("a", { ...arquivo, chave_armazenamento: chave })).toBe(false);
  expect(arquivoDoProjeto("a", { ...arquivo, projeto_id: "b" })).toBe(false);
  expect(arquivoDoProjeto("a", { ...arquivo, mime_type: "text/html" })).toBe(false);
});
