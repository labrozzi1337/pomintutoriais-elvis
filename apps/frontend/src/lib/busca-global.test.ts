import { expect, it } from "vitest";
import { buscarGlobalmente, normalizarBusca, type ItemBuscaGlobal } from "./busca-global";

const itens: ItemBuscaGlobal[] = [
  { id: "1", titulo: "Criação de vídeo", descricao: "Tutorial fiscal", termos: ["Solutta"], destino: "/criar", categoria: "Tutorial" },
  { id: "2", titulo: "Organização", descricao: "Empresas e áreas", termos: [], destino: "/organizacao", categoria: "Página" }
];

it("ignora acentos e prioriza o título", () => {
  expect(normalizarBusca("Criação — Vídeo")).toBe("criacao video");
  expect(buscarGlobalmente(itens, "criacao video")[0]?.id).toBe("1");
  expect(buscarGlobalmente(itens, "solutta fiscal")[0]?.id).toBe("1");
});
