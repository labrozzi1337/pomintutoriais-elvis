import { expect, it, vi } from "vitest";
import { criarAnalise } from "./roteiro-repository";

it("libera somente análises legadas concluídas antes de solicitar nova versão", async () => {
  const legado = { eq: vi.fn((): object => legado), not: vi.fn(() => Promise.resolve({ error: null })) };
  const video = { select: (): object => video, eq: (): object => video, maybeSingle: () => Promise.resolve({ data: { id: "video", projeto_id: "projeto", status: "pronto", duracao_ms: 1000 }, error: null }) };
  const roteiro = { select: (): object => roteiro, eq: (): object => roteiro, order: (): object => roteiro, limit: (): object => roteiro, maybeSingle: () => Promise.resolve({ data: { id: "roteiro", edicoes_humanas: true }, error: null }) };
  const update = vi.fn(() => legado);
  const tabelas = {
    videos: video, roteiros: roteiro,
    processamentos: { update, insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "job-novo" }, error: null }) }) }) },
    roteiro_eventos: { insert: () => Promise.resolve({ error: null }) }
  };
  const cliente = { from: (tabela: string) => tabelas[tabela as keyof typeof tabelas] } as never;
  await expect(criarAnalise(cliente, "video", "usuario", false)).rejects.toThrow("SCRIPT_REPLACEMENT_CONFIRMATION_REQUIRED");
  expect(update).not.toHaveBeenCalled();
  expect(await criarAnalise(cliente, "video", "usuario", true)).toEqual({ id: "job-novo" });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "concluido" }));
  expect(legado.eq.mock.calls).toEqual([["video_id", "video"], ["tipo", "analisar_video"], ["status", "roteiro_pronto"]]);
  expect(legado.not).toHaveBeenCalledWith("concluido_em", "is", null);
});
