import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { ArmazenamentoB2, hashArquivo } from "../services/b2";

const raizes = process.argv.slice(2).map((p) => path.resolve(p));
if (!raizes.length) throw new Error("Informe os diretórios de armazenamento a migrar.");
const b2 = new ArmazenamentoB2();
const arquivos = new Map<string, { caminho: string; hash: string; tamanho: number }>();
const mimes: Record<string, string> = { ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".srt": "application/x-subrip", ".vtt": "text/vtt" };

async function inventariar(raiz: string, diretorio: string): Promise<void> {
  for (const item of await readdir(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, item.name);
    if (item.isDirectory()) await inventariar(raiz, caminho);
    else if (item.isFile() && mimes[path.extname(caminho).toLowerCase()]) {
      const chave = path.relative(raiz, caminho).split(path.sep).join("/");
      const hash = await hashArquivo(caminho);
      const anterior = arquivos.get(chave);
      if (anterior && anterior.hash !== hash) throw new Error(`Conflito entre origens: ${chave}`);
      arquivos.set(chave, { caminho, hash, tamanho: (await stat(caminho)).size });
    }
  }
}

async function main() {
  // Verifica conflitos entre as cópias antes de enviar qualquer arquivo.
  for (const raiz of raizes) await inventariar(raiz, path.join(raiz, "projetos"));
  let enviados = 0, existentes = 0;
  for (const [chave, arquivo] of arquivos) {
    const remoto = await b2.metadados(chave);
    if (remoto) {
      if (remoto.Metadata?.sha256 !== arquivo.hash || remoto.ContentLength !== arquivo.tamanho) throw new Error(`Objeto remoto diferente, não sobrescrito: ${chave}`);
      existentes++;
    } else {
      await b2.enviarArquivo(chave, arquivo.caminho, mimes[path.extname(arquivo.caminho).toLowerCase()]!, arquivo.hash);
      const verificacao = await b2.metadados(chave);
      if (verificacao?.Metadata?.sha256 !== arquivo.hash || verificacao.ContentLength !== arquivo.tamanho) throw new Error(`Verificação falhou: ${chave}`);
      enviados++;
    }
    console.log(JSON.stringify({ verificados: enviados + existentes, total: arquivos.size, enviados, existentes }));
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "B2_MIGRATION_FAILED"); process.exitCode = 1; });
