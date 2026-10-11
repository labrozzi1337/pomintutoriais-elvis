import { describe, expect, it } from "vitest";
import { conexaoRedis, opcoesTrabalhoVideo } from "@/services/fila-processamentos";

describe("fila de processamentos", () => {
  it("usa job determinístico e retry exponencial limitado", () => {
    const primeira = opcoesTrabalhoVideo("processamento-1");
    const repetida = opcoesTrabalhoVideo("processamento-1");
    expect(primeira.jobId).toBe(repetida.jobId);
    expect(primeira.attempts).toBe(3);
    expect(primeira.backoff).toEqual({ type: "exponential", delay: 2_000 });
  });

  it("falha rápido na API e mantém o worker reconectável", () => {
    expect(conexaoRedis("redis://localhost:6379").maxRetriesPerRequest).toBe(1);
    expect(conexaoRedis("redis://localhost:6379", null).maxRetriesPerRequest).toBeNull();
  });
});
