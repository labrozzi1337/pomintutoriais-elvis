import { describe, expect, it } from "vitest";
import { gerarTopicosWiki } from "@/services/openai-topicos-wiki";

describe("títulos funcionais da Wiki", () => {
  it("transforma grupos válidos em intervalos reais do vídeo", async () => {
    let requisicao: unknown;
    const cliente = { responses: { parse: (entrada: unknown) => {
      requisicao = entrada;
      return Promise.resolve({ status: "completed", output_parsed: { topicos: [
        { inicioIndice: 0, fimIndice: 0, titulo: "Tutorial para levantar débitos da CND RFB" },
        { inicioIndice: 1, fimIndice: 2, titulo: "Executando login na plataforma gov.br" }
      ] } });
    } } };
    const resultado = await gerarTopicosWiki({ apiKey: "teste", modelo: "gpt-6.1-sol", tituloTutorial: "CND", blocos: [
      { inicioMs: 0, fimMs: 4_000, acaoVisual: "Cartela", narracao: "Introdução" },
      { inicioMs: 4_000, fimMs: 8_000, acaoVisual: "Identificação", narracao: "Login" },
      { inicioMs: 8_000, fimMs: 12_000, acaoVisual: "Certificado", narracao: "Confirmação" }
    ] }, cliente as never);
    expect(resultado).toEqual([
      { titulo: "Tutorial para levantar débitos da CND RFB", inicioMs: 0, fimMs: 4_000 },
      { titulo: "Executando login na plataforma gov.br", inicioMs: 4_000, fimMs: 12_000 }
    ]);
    expect(JSON.stringify(requisicao)).toContain("nunca descrever o estado visual");
  });

  it("recusa capítulos que deixam etapas sem cobertura", async () => {
    const cliente = { responses: { parse: () => Promise.resolve({ status: "completed", output_parsed: { topicos: [{ inicioIndice: 1, fimIndice: 1, titulo: "Login na plataforma" }] } }) } };
    await expect(gerarTopicosWiki({ apiKey: "teste", modelo: "gpt-6.1-sol", tituloTutorial: "Login", blocos: [
      { inicioMs: 0, fimMs: 1_000, acaoVisual: "Abertura", narracao: "" },
      { inicioMs: 1_000, fimMs: 2_000, acaoVisual: "Login", narracao: "" }
    ] }, cliente as never)).rejects.toThrow("OPENAI_TOPICOS_INVALID_RANGE");
  });
});
