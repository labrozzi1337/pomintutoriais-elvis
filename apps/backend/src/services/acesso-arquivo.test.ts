import { describe, expect, it } from "vitest";
import { assinarAcesso, validarAcesso } from "@/services/acesso-arquivo";

const secret = "segredo-de-teste-com-mais-de-32-caracteres";
const videoA = "11111111-1111-4111-8111-111111111111";
const videoB = "22222222-2222-4222-8222-222222222222";

describe("acesso protegido a arquivos", () => {
  it("impede reutilizar o acesso em outro vídeo", () => {
    const token = assinarAcesso({ videoId: videoA, usuarioId: "usuario-a", modo: "reproduzir", expiraEm: 2_000 }, secret);
    expect(validarAcesso(token, videoB, secret, 1_000)).toBeNull();
    expect(validarAcesso(token, videoA, secret, 1_000)?.usuarioId).toBe("usuario-a");
  });

  it("rejeita token expirado ou adulterado", () => {
    const token = assinarAcesso({ videoId: videoA, usuarioId: "usuario-a", modo: "baixar", expiraEm: 2_000 }, secret);
    expect(validarAcesso(token, videoA, secret, 2_001)).toBeNull();
    expect(validarAcesso(`${token}x`, videoA, secret, 1_000)).toBeNull();
  });
});
