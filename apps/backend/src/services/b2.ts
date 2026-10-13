import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, ListPartsCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import type { ManifestoUpload } from "./armazenamento-arquivos";

export const PREFIXO_B2 = "POMIN-TUTORIAIS/";
export const TAMANHO_PARTE_B2 = 8 * 1024 * 1024;
const configSchema = z.object({ B2_KEY_ID: z.string().min(1), B2_APPLICATION_KEY: z.string().min(1), B2_BUCKET_NAME: z.string().min(1), B2_ENDPOINT: z.string().min(1), B2_REGION: z.string().min(1) });
type UploadB2 = ManifestoUpload & { multipartId: string; chave: string };

export function chaveB2(chave: string): string {
  if (!chave || chave.includes("\\") || chave.split("/").some((p) => !p || p === "." || p === "..") || [...chave].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new Error("STORAGE_KEY_INVALID");
  return PREFIXO_B2 + chave;
}

export function b2Configurada(): boolean {
  const presente = Object.keys(configSchema.shape).some((key) => Boolean(process.env[key]));
  if (presente && !configSchema.safeParse(process.env).success) throw new Error("B2_CONFIGURATION_INCOMPLETE");
  if (!presente) throw new Error("B2_CONFIGURATION_REQUIRED");
  return true;
}

export class ArmazenamentoB2 {
  readonly client: S3Client;
  readonly bucket: string;
  constructor() {
    const env = configSchema.parse(process.env);
    this.bucket = env.B2_BUCKET_NAME;
    const endpoint = new URL(env.B2_ENDPOINT.startsWith("https://") ? env.B2_ENDPOINT : `https://${env.B2_ENDPOINT}`);
    if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".backblazeb2.com")) throw new Error("B2_ENDPOINT_INVALID");
    this.client = new S3Client({ endpoint: endpoint.origin, region: env.B2_REGION, credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APPLICATION_KEY }, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" });
  }
  async metadados(chave: string) {
    try { return await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave) })); }
    catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null; throw error; }
  }
  async salvar(chave: string, dados: Uint8Array, mime = "application/octet-stream") {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave), Body: dados, ContentType: mime }));
  }
  async enviarArquivo(chave: string, arquivo: string, mime: string, hash: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave), Body: createReadStream(arquivo), ContentLength: (await stat(arquivo)).size, ContentType: mime, Metadata: { sha256: hash } }));
  }
  async excluir(chave: string) { await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave) })); }
  async url(chave: string, mime: string, nome?: string) {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave), ResponseContentType: mime, ResponseCacheControl: "private, no-store", ...(nome ? { ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(nome)}` } : {}) }), { expiresIn: 300 });
  }
  async baixar(chave: string, destino: string) {
    const resposta = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: chaveB2(chave) }));
    if (!resposta.Body) throw new Error("B2_EMPTY_BODY");
    await mkdir(path.dirname(destino), { recursive: true });
    const temporario = `${destino}.${crypto.randomUUID()}.tmp`;
    try { await pipeline(resposta.Body as Readable, createWriteStream(temporario, { flags: "wx" })); await rename(temporario, destino); }
    finally { await rm(temporario, { force: true }); }
  }
  private manifestoKey(usuario: string, id: string) { return `.uploads/${usuario}/${id}.json`; }
  async iniciarUpload(manifesto: ManifestoUpload) {
    const chave = `projetos/${manifesto.projetoId}/originais/${manifesto.id}.mp4`;
    const upload = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: chaveB2(chave), ContentType: "video/mp4" }));
    if (!upload.UploadId) throw new Error("B2_UPLOAD_CREATE_FAILED");
    try {
      await this.salvar(this.manifestoKey(manifesto.usuarioId, manifesto.id), Buffer.from(JSON.stringify({ ...manifesto, chave, multipartId: upload.UploadId })), "application/json");
      return await Promise.all(Array.from({ length: Math.ceil(manifesto.tamanhoEsperado / TAMANHO_PARTE_B2) }, (_, i) => getSignedUrl(this.client, new UploadPartCommand({ Bucket: this.bucket, Key: chaveB2(chave), UploadId: upload.UploadId, PartNumber: i + 1, ContentLength: Math.min(TAMANHO_PARTE_B2, manifesto.tamanhoEsperado - i * TAMANHO_PARTE_B2) }), { expiresIn: 3600 })));
    } catch (error) {
      await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: chaveB2(chave), UploadId: upload.UploadId })).catch(() => undefined);
      throw error;
    }
  }
  async obterUpload(usuario: string, id: string): Promise<UploadB2 | null> {
    if (!await this.metadados(this.manifestoKey(usuario, id))) return null;
    const resposta = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: chaveB2(this.manifestoKey(usuario, id)) }));
    const manifesto = JSON.parse(await resposta.Body!.transformToString()) as UploadB2;
    if (manifesto.usuarioId !== usuario || manifesto.id !== id) throw new Error("B2_UPLOAD_OWNER_INVALID");
    return manifesto;
  }
  async promoverUpload(entrada: ManifestoUpload, videoId: string) {
    const manifesto = await this.obterUpload(entrada.usuarioId, entrada.id);
    if (!manifesto) throw new Error("UPLOAD_NOT_FOUND");
    if (videoId !== manifesto.id) throw new Error("B2_UPLOAD_ID_INVALID");
    if (!await this.metadados(manifesto.chave)) {
      const partes = await this.client.send(new ListPartsCommand({ Bucket: this.bucket, Key: chaveB2(manifesto.chave), UploadId: manifesto.multipartId }));
      const lista = partes.Parts ?? [];
      if (partes.IsTruncated || lista.length !== Math.ceil(manifesto.tamanhoEsperado / TAMANHO_PARTE_B2) || lista.some((p, i) => p.PartNumber !== i + 1 || p.Size !== Math.min(TAMANHO_PARTE_B2, manifesto.tamanhoEsperado - i * TAMANHO_PARTE_B2))) throw new Error("UPLOAD_PART_SIZE_MISMATCH");
      await this.client.send(new CompleteMultipartUploadCommand({ Bucket: this.bucket, Key: chaveB2(manifesto.chave), UploadId: manifesto.multipartId, MultipartUpload: { Parts: lista.map(({ ETag, PartNumber }) => ({ ETag, PartNumber })) } }));
    }
    const objeto = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: chaveB2(manifesto.chave) }));
    if (objeto.ContentLength !== manifesto.tamanhoEsperado || !objeto.Body) throw new Error("UPLOAD_PART_SIZE_MISMATCH");
    const hash = createHash("sha256");
    let cabecalho = Buffer.alloc(0);
    for await (const pedaco of objeto.Body as Readable) { const b = Buffer.from(pedaco); if (cabecalho.length < 12) cabecalho = Buffer.concat([cabecalho, b.subarray(0, 12 - cabecalho.length)]); hash.update(b); }
    if (cabecalho.length < 12 || cabecalho.subarray(4, 8).toString("ascii") !== "ftyp") throw new Error("UPLOAD_NOT_MP4");
    await this.salvar(this.manifestoKey(manifesto.usuarioId, manifesto.id), Buffer.from(JSON.stringify({ ...manifesto, videoId, bytesRecebidos: manifesto.tamanhoEsperado })), "application/json");
    return { chave: manifesto.chave, hashSha256: hash.digest("hex") };
  }
}

export async function hashArquivo(arquivo: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const parte of createReadStream(arquivo)) hash.update(parte as Buffer);
  return hash.digest("hex");
}
