import { expect, it, vi } from "vitest";
import { log } from "./logger";

it("não registra detalhes de provedor, paths ou PII no código de erro", () => {
  const saida = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    log("error", "Falha no processamento.", { event: "teste", errorCode: "FFMPEG_FAILED:arquivo-cliente.mp4:conteúdo sensível" });
    expect((JSON.parse(saida.mock.calls[0]![0] as string) as { errorCode: string }).errorCode).toBe("FFMPEG_FAILED");
    log("error", "Falha no processamento.", { event: "teste", errorCode: "senha-ou-email@example.invalid" });
    expect((JSON.parse(saida.mock.calls[1]![0] as string) as { errorCode: string }).errorCode).toBe("UNEXPECTED_ERROR");
  } finally { saida.mockRestore(); }
});
