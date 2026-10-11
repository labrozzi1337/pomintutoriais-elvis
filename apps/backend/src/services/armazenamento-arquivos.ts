import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export interface ManifestoUpload {
  id: string;
  projetoId: string;
  usuarioId: string;
  nomeOriginal: string;
  mimeType: "video/mp4";
  tamanhoEsperado: number;
  bytesRecebidos: number;
  videoId?: string;
}

export interface ArmazenamentoArquivos {
  iniciarUpload(manifesto: ManifestoUpload): Promise<void>;
  obterUpload(usuarioId: string, uploadId: string): Promise<ManifestoUpload | null>;
  escreverParte(manifesto: ManifestoUpload, corpo: ReadableStream<Uint8Array>, tamanho: number): Promise<ManifestoUpload>;
  promoverUpload(manifesto: ManifestoUpload, videoId: string): Promise<{ chave: string; hashSha256: string }>;
  salvar(chave: string, dados: Uint8Array): Promise<void>;
  caminhoAbsoluto(chave: string): string;
  excluir(chave: string): Promise<void>;
}

export class ArmazenamentoLocal implements ArmazenamentoArquivos {
  public constructor(private readonly raiz: string) {}

  /** Persiste uma sessão recuperável sem usar o nome externo como caminho. */
  public async iniciarUpload(manifesto: ManifestoUpload): Promise<void> {
    await mkdir(this.diretorioUpload(manifesto.usuarioId), { recursive: true });
    await writeFile(this.caminhoManifesto(manifesto.usuarioId, manifesto.id), JSON.stringify(manifesto), { flag: "wx" });
  }

  /** Lê o manifesto pertencente ao usuário, retornando ausência sem revelar outros uploads. */
  public async obterUpload(usuarioId: string, uploadId: string): Promise<ManifestoUpload | null> {
    try {
      return JSON.parse(await readFile(this.caminhoManifesto(usuarioId, uploadId), "utf8")) as ManifestoUpload;
    } catch (error) {
      if (codigoErro(error) === "ENOENT") return null;
      throw error;
    }
  }

  /** Grava uma parte sequencial por streaming e atualiza o progresso de forma atômica. */
  public async escreverParte(manifesto: ManifestoUpload, corpo: ReadableStream<Uint8Array>, tamanho: number): Promise<ManifestoUpload> {
    const lock = await open(`${this.caminhoManifesto(manifesto.usuarioId, manifesto.id)}.lock`, "wx");
    const parte = `${this.caminhoTemporario(manifesto.usuarioId, manifesto.id)}.parte`;
    try {
      await escreverStream(parte, corpo, tamanho);
      await pipeline(createReadStream(parte), createWriteStream(this.caminhoTemporario(manifesto.usuarioId, manifesto.id), { flags: "a" }));
      const atualizado = { ...manifesto, bytesRecebidos: manifesto.bytesRecebidos + tamanho };
      await this.salvarManifesto(atualizado);
      return atualizado;
    } finally {
      await lock.close();
      await rm(parte, { force: true });
      await rm(`${this.caminhoManifesto(manifesto.usuarioId, manifesto.id)}.lock`, { force: true });
    }
  }

  /** Valida o contêiner MP4, calcula hash e move o upload para sua chave definitiva. */
  public async promoverUpload(manifesto: ManifestoUpload, videoId: string): Promise<{ chave: string; hashSha256: string }> {
    const origem = this.caminhoTemporario(manifesto.usuarioId, manifesto.id);
    const chave = path.posix.join("projetos", manifesto.projetoId, "originais", `${videoId}.mp4`);
    const destino = this.caminhoAbsoluto(chave);
    if (manifesto.videoId === videoId && await arquivoExiste(destino)) {
      return { chave, hashSha256: await calcularSha256(destino) };
    }
    if (!(await possuiAssinaturaMp4(origem))) throw new Error("UPLOAD_NOT_MP4");
    await mkdir(path.dirname(destino), { recursive: true });
    await rename(origem, destino);
    const hashSha256 = await calcularSha256(destino);
    await this.salvarManifesto({ ...manifesto, videoId });
    return { chave, hashSha256 };
  }

  /** Grava um artefato pequeno em destino interno por substituição atômica. */
  public async salvar(chave: string, dados: Uint8Array): Promise<void> {
    const destino = this.caminhoAbsoluto(chave);
    const temporario = `${destino}.${crypto.randomUUID()}.tmp`;
    await mkdir(path.dirname(destino), { recursive: true });
    try { await writeFile(temporario, dados, { flag: "wx" }); await rename(temporario, destino); }
    finally { await rm(temporario, { force: true }); }
  }

  /** Resolve somente chaves internas normalizadas dentro da raiz configurada. */
  public caminhoAbsoluto(chave: string): string {
    const absoluto = path.resolve(this.raiz, chave);
    const raizAbsoluta = `${path.resolve(this.raiz)}${path.sep}`;
    if (!absoluto.startsWith(raizAbsoluta)) throw new Error("STORAGE_KEY_INVALID");
    return absoluto;
  }

  /** Remove um arquivo interno; ausência mantém a operação idempotente. */
  public async excluir(chave: string): Promise<void> {
    await rm(this.caminhoAbsoluto(chave), { force: true });
  }

  private diretorioUpload(usuarioId: string): string {
    return path.resolve(this.raiz, ".uploads", usuarioId);
  }

  private caminhoManifesto(usuarioId: string, uploadId: string): string {
    return path.join(this.diretorioUpload(usuarioId), `${uploadId}.json`);
  }

  private caminhoTemporario(usuarioId: string, uploadId: string): string {
    return path.join(this.diretorioUpload(usuarioId), `${uploadId}.mp4.upload`);
  }

  private async salvarManifesto(manifesto: ManifestoUpload): Promise<void> {
    const destino = this.caminhoManifesto(manifesto.usuarioId, manifesto.id);
    const temporario = `${destino}.tmp`;
    await writeFile(temporario, JSON.stringify(manifesto));
    await rename(temporario, destino);
  }
}

/** Normaliza o nome apenas para metadado e nunca o reutiliza como caminho. */
export function normalizarNomeArquivo(nome: string): string {
  return [...path.basename(nome)]
    .filter((caractere) => caractere.charCodeAt(0) > 31 && caractere.charCodeAt(0) !== 127)
    .join("")
    .slice(0, 255);
}

/** Confere a assinatura ftyp exigida por contêineres MP4 antes de chamar FFprobe. */
export async function possuiAssinaturaMp4(caminho: string): Promise<boolean> {
  const arquivo = await open(caminho, "r");
  try {
    const cabecalho = Buffer.alloc(12);
    const { bytesRead } = await arquivo.read(cabecalho, 0, cabecalho.length, 0);
    return bytesRead === cabecalho.length && cabecalho.subarray(4, 8).toString("ascii") === "ftyp";
  } finally {
    await arquivo.close();
  }
}

/** Grava a parte em arquivo exclusivo e rejeita divergência do Content-Length. */
async function escreverStream(caminho: string, corpo: ReadableStream<Uint8Array>, tamanhoEsperado: number): Promise<void> {
  const arquivo = await open(caminho, "wx");
  const leitor = corpo.getReader();
  let recebido = 0;
  try {
    while (true) {
      const { done, value: pedaco } = await leitor.read();
      if (done) break;
      recebido += pedaco.byteLength;
      if (recebido > tamanhoEsperado) throw new Error("UPLOAD_PART_SIZE_MISMATCH");
      await arquivo.write(pedaco);
    }
    if (recebido !== tamanhoEsperado) throw new Error("UPLOAD_PART_SIZE_MISMATCH");
  } finally {
    leitor.releaseLock();
    await arquivo.close();
    if (recebido !== tamanhoEsperado) await rm(caminho, { force: true });
  }
}

/** Calcula o hash por streaming para auditoria sem carregar o vídeo em memória. */
async function calcularSha256(caminho: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const pedaco of createReadStream(caminho)) hash.update(pedaco as Buffer);
  return hash.digest("hex");
}

/** Extrai o código portável de erros do sistema de arquivos. */
function codigoErro(error: unknown): string | undefined {
  return error instanceof Error && "code" in error ? String(error.code) : undefined;
}

/** Confere a existência de um destino já promovido para permitir retry idempotente. */
async function arquivoExiste(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch (error) {
    if (codigoErro(error) === "ENOENT") return false;
    throw error;
  }
}
