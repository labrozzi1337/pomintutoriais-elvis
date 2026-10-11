import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArmazenamentoLocal, normalizarNomeArquivo, possuiAssinaturaMp4 } from "@/services/armazenamento-arquivos";

const temporarios: string[] = [];

afterEach(async () => {
  await Promise.all(temporarios.splice(0).map((diretorio) => rm(diretorio, { recursive: true, force: true })));
});

describe("armazenamento de upload", () => {
  it("rejeita arquivo com extensão MP4 e conteúdo falso", async () => {
    const diretorio = await mkdtemp(path.join(tmpdir(), "estudio-upload-"));
    temporarios.push(diretorio);
    const arquivo = path.join(diretorio, "falso.mp4");
    await writeFile(arquivo, "não é vídeo");
    await expect(possuiAssinaturaMp4(arquivo)).resolves.toBe(false);
  });

  it("mantém chaves internas dentro da raiz", () => {
    const armazenamento = new ArmazenamentoLocal("C:/dados/estudio");
    expect(() => armazenamento.caminhoAbsoluto("../../segredo")).toThrow("STORAGE_KEY_INVALID");
    expect(normalizarNomeArquivo("../video\u0000.mp4")).toBe("video.mp4");
  });

  it("persiste um artefato pequeno apenas dentro da raiz", async () => {
    const diretorio = await mkdtemp(path.join(tmpdir(), "estudio-artefato-"));
    temporarios.push(diretorio);
    const armazenamento = new ArmazenamentoLocal(diretorio);
    await armazenamento.salvar("projetos/a/thumbnails/capa.jpg", new Uint8Array([1, 2, 3]));
    await expect(readFile(path.join(diretorio, "projetos/a/thumbnails/capa.jpg"))).resolves.toEqual(Buffer.from([1, 2, 3]));
  });
});
