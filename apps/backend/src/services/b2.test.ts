import { afterEach, describe, expect, it, vi } from "vitest";
import { ArmazenamentoB2, b2Configurada, chaveB2, TAMANHO_PARTE_B2 } from "./b2";

afterEach(() => vi.unstubAllEnvs());
function configurar() {
  vi.stubEnv("B2_KEY_ID", "test"); vi.stubEnv("B2_APPLICATION_KEY", "test");
  vi.stubEnv("B2_BUCKET_NAME", "test"); vi.stubEnv("B2_ENDPOINT", "s3.us-west-004.backblazeb2.com"); vi.stubEnv("B2_REGION", "us-west-004");
}
describe("armazenamento B2", () => {
  it("preserva a hierarquia e rejeita chaves fora do prefixo", () => {
    expect(chaveB2("projetos/a/originais/video.mp4")).toBe("POMIN-TUTORIAIS/projetos/a/originais/video.mp4");
    for (const chave of ["../segredo", "/segredo", "projetos//a", "projetos/./a", "a\\b", "a\u0000b"]) expect(() => chaveB2(chave)).toThrow("STORAGE_KEY_INVALID");
  });
  it("falha explicitamente se a configuração está incompleta", () => {
    configurar(); vi.stubEnv("B2_APPLICATION_KEY", "");
    expect(() => b2Configurada()).toThrow("B2_CONFIGURATION_INCOMPLETE");
  });
  it("não permite armazenamento local quando B2 não está configurada", () => {
    for (const chave of ["B2_KEY_ID", "B2_APPLICATION_KEY", "B2_BUCKET_NAME", "B2_ENDPOINT", "B2_REGION"]) vi.stubEnv(chave, "");
    expect(() => b2Configurada()).toThrow("B2_CONFIGURATION_REQUIRED");
  });
  it("não permite concluir partes incompletas ou de tamanho adulterado", async () => {
    configurar(); const b2 = new ArmazenamentoB2();
    const manifesto = { id: "upload", usuarioId: "usuario", projetoId: "projeto", nomeOriginal: "video.mp4", mimeType: "video/mp4" as const, tamanhoEsperado: TAMANHO_PARTE_B2 + 2, bytesRecebidos: 0, chave: "projetos/projeto/originais/upload.mp4", multipartId: "multipart" };
    vi.spyOn(b2, "obterUpload").mockResolvedValue(manifesto);
    vi.spyOn(b2, "metadados").mockResolvedValue(null);
    const send = vi.spyOn(b2.client, "send").mockResolvedValue({ Parts: [{ PartNumber: 1, Size: 10, ETag: "test" }] });
    await expect(b2.promoverUpload(manifesto, "upload")).rejects.toThrow("UPLOAD_PART_SIZE_MISMATCH");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
