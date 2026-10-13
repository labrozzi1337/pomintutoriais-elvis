import { beforeEach, describe, expect, it, vi } from "vitest";
import { processarVideoNaVercel } from "./video";
import { iniciarSandbox, consultarSandbox, encerrarSandbox, falharProcessamento } from "./video-steps";

vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "wrun_test" }), sleep: vi.fn() }));
vi.mock("./video-steps", () => ({ iniciarSandbox: vi.fn(), consultarSandbox: vi.fn(), encerrarSandbox: vi.fn(), falharProcessamento: vi.fn() }));

describe("processamento durável na Vercel", () => {
  beforeEach(() => vi.resetAllMocks());
  it("aguarda o processamento e encerra a máquina ao concluir", async () => {
    vi.mocked(consultarSandbox).mockResolvedValueOnce(null).mockResolvedValueOnce({ proximo: null });
    await processarVideoNaVercel("video", "validar-video");
    expect(consultarSandbox).toHaveBeenCalledTimes(2);
    expect(encerrarSandbox).toHaveBeenCalledWith("pomin-video");
    expect(falharProcessamento).not.toHaveBeenCalled();
  });
  it("continua a narração automática em um novo sandbox", async () => {
    vi.mocked(consultarSandbox).mockResolvedValueOnce({ proximo: "voz" }).mockResolvedValueOnce({ proximo: null });
    await processarVideoNaVercel("analise", "analisar-video");
    expect(iniciarSandbox).toHaveBeenNthCalledWith(2, "voz", "gerar-narracao", "wrun_test", "pomin-voz");
    expect(encerrarSandbox).toHaveBeenCalledTimes(2);
  });
  it("persiste falha e encerra o sandbox se o processo falhar", async () => {
    vi.mocked(consultarSandbox).mockRejectedValue(new Error("FAILED"));
    await expect(processarVideoNaVercel("video", "validar-video")).rejects.toThrow("FAILED");
    expect(falharProcessamento).toHaveBeenCalledWith("video", "validar-video");
    expect(encerrarSandbox).toHaveBeenCalledWith("pomin-video");
  });
  it("não deixa jobs indefinidamente ativos ao exceder o prazo", async () => {
    vi.mocked(consultarSandbox).mockResolvedValue(null);
    await expect(processarVideoNaVercel("video", "validar-video")).rejects.toThrow("PROCESSING_TIMEOUT");
    expect(consultarSandbox).toHaveBeenCalledTimes(132);
    expect(falharProcessamento).toHaveBeenCalledOnce();
    expect(encerrarSandbox).toHaveBeenCalledOnce();
  });
});
