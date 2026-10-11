import { describe, expect, it } from "vitest";
import { gerarRoteiroComIa } from "@/services/openai-roteiro";

describe("integração explícita com provedor simulado", () => {
  it("usa o padrão fluido do POP-1.1 e evita narração metalinguística", async () => {
    let requisicao: unknown;
    const cliente = { responses: { parse: (entrada: unknown) => {
      requisicao = entrada;
      return Promise.resolve({ id: "resp_prompt", status: "completed", incomplete_details: null, output_parsed: { cenas: [{ inicioMs: 0, fimMs: 900, tituloTopico: "Consulta de resultados", acaoVisual: "Resultado", narracao: "Confira o resultado.", evidenciasFrame: [], confianca: 1 }] }, usage: null });
    } } };
    await gerarRoteiroComIa({ apiKey: "teste", modelo: "gpt-6.1-sol", duracaoVideoMs: 1_000, quadros: [] }, cliente as never);
    const prompt = JSON.stringify(requisicao);
    expect(prompt).toContain("padrão editorial do POP-1.1");
    expect(prompt).toContain("evitando pausas longas");
    expect(prompt).toContain("nunca use frases metalinguísticas");
    expect(prompt).toContain("ensinar o funcionamento estável da plataforma");
    expect(prompt).toContain("Não os transforme no assunto da narração");
    expect(prompt).toContain("Nesta área, você consulta e organiza os registros cadastrados");
    expect(prompt).toContain("Não crie um tópico para cada clique");
    expect(prompt).toContain("nunca o que a narração diz");
    expect(prompt).toContain("Acessando dados do cliente com certificado");
  });

  it("valida a resposta estruturada antes de aceitá-la", async () => {
    const cliente = { responses: { parse: () => Promise.resolve({
      id: "resp_teste", status: "completed", incomplete_details: null,
      output_parsed: { cenas: [{ inicioMs: 0, fimMs: 900, tituloTopico: "Navegação pelo menu", acaoVisual: "Menu aberto.", narracao: "Abra o menu.", evidenciasFrame: [0], confianca: 0.9 }] },
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
    }) } };
    const resultado = await gerarRoteiroComIa({ apiKey: "teste", modelo: "gpt-6.1-sol", duracaoVideoMs: 1_000, quadros: [] }, cliente as never);
    expect(resultado.blocos[0]?.fimMs).toBe(900);
    expect(resultado.uso.totalTokens).toBe(15);
    expect(resultado.topicos).toEqual([{ titulo: "Navegação pelo menu", inicioMs: 0, fimMs: 900 }]);
  });

  it("descarta evidência inexistente ou fora da cena sem mudar a timeline", async () => {
    const cliente = { responses: { parse: () => Promise.resolve({
      status: "completed", id: "resp_2", usage: null,
      output_parsed: { cenas: [{ inicioMs: 0, fimMs: 1_000, tituloTopico: "Consulta de informações", acaoVisual: "Tela", narracao: "Texto", evidenciasFrame: [2_000], confianca: 0.8 }] }
    }) } } as never;
    const resultado = await gerarRoteiroComIa({ apiKey: "teste", modelo: "gpt-6.1-sol", duracaoVideoMs: 2_000, quadros: [] }, cliente);
    expect(resultado.blocos[0]?.evidenciasFrame).toEqual([]);
    expect(resultado.blocos[0]?.fimMs).toBe(1_000);
  });

  it("preserva erro de timeout sem fabricar um roteiro", async () => {
    const cliente = { responses: { parse: () => Promise.reject(new Error("TIMEOUT_TEST")) } } as never;
    await expect(gerarRoteiroComIa({ apiKey: "teste", modelo: "gpt-6.1-sol", duracaoVideoMs: 1000, quadros: [] }, cliente)).rejects.toThrow("TIMEOUT_TEST");
  });
});
