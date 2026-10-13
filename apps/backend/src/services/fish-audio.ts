import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type ModeloFish = "s2.1-pro-free" | "s2.1-pro";

export interface ConfiguracaoFish {
  modelo: ModeloFish;
  temperatura?: number;
  topP?: number;
}

export interface EntradaFish {
  texto: string;
  referenceId: string;
  destino: string;
  configuracao: ConfiguracaoFish;
  signal?: AbortSignal;
}

type FetchFish = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const DIRECAO_VOZ = "[português brasileiro, didático e conversado, ritmo natural, entonação descendente ao concluir cada frase]";

/** Adapter isolado para o contrato oficial POST /v1/tts da Fish Audio. */
export class ProvedorFishAudio {
  public constructor(
    private readonly apiKey: string,
    private readonly fetchFish: FetchFish = fetch,
    private readonly timeoutMs = 120_000
  ) {}

  public async gerar(entrada: EntradaFish): Promise<void> {
    const temporario = `${entrada.destino}.tmp`;
    await mkdir(path.dirname(entrada.destino), { recursive: true });
    try {
      for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
        entrada.signal?.throwIfAborted();
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const signal = entrada.signal ? AbortSignal.any([entrada.signal, timeout]) : timeout;
        const resposta = await this.fetchFish("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            model: entrada.configuracao.modelo
          },
          body: JSON.stringify({
            text: prepararTextoFish(entrada.texto),
            reference_id: entrada.referenceId,
            format: "mp3",
            temperature: entrada.configuracao.temperatura ?? 0.6,
            top_p: entrada.configuracao.topP ?? 0.7,
            latency: "normal",
            normalize: false,
            prosody: { normalize_loudness: true }
          }),
          signal
        });
        if (resposta.ok) {
          const audio = Buffer.from(await resposta.arrayBuffer());
          if (audio.length < 256) throw new Error("FISH_INVALID_AUDIO");
          await writeFile(temporario, audio);
          await rename(temporario, entrada.destino);
          return;
        }
        const detalhe = (await resposta.text()).slice(0, 300);
        if (resposta.status === 402 || resposta.status === 403) throw new Error(`FISH_PLAN_RESTRICTED:${detalhe}`);
        if (resposta.status !== 429 && resposta.status < 500) throw new Error(`FISH_REQUEST_REJECTED:${resposta.status}:${detalhe}`);
        if (tentativa === 3) throw new Error(`FISH_UNAVAILABLE:${resposta.status}`);
        await esperar(500 * 2 ** (tentativa - 1), entrada.signal);
      }
    } finally {
      await rm(temporario, { force: true });
    }
  }
}

/** Garante cache estável quando texto, voz, modelo ou parâmetros mudarem. */
export function hashNarracao(texto: string, voz: string, configuracao: ConfiguracaoFish, versao = "fish-v2-ptbr"): string {
  return createHash("sha256").update(JSON.stringify({ texto: prepararTextoFish(texto), voz, configuracao, versao })).digest("hex");
}

export function normalizarTextoNarracao(texto: string): string {
  return texto.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Direções S2 ficam somente na síntese; copy e legendas mantêm o texto original. */
export function prepararTextoFish(texto: string): string {
  const fala = normalizarTextoNarracao(texto).replace(/(?:\.{2,}|…|[,;:])+$/u, "").trim();
  if (!fala) throw new Error("FISH_EMPTY_TEXT");
  return `${DIRECAO_VOZ} ${fala}${/[.!?]["'”’»)\]]*$/u.test(fala) ? "" : "."}`;
}

function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancelar = () => { clearTimeout(timer); reject(new Error("FISH_CANCELLED", { cause: signal?.reason })); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", cancelar); resolve(); }, ms);
    signal?.addEventListener("abort", cancelar, { once: true });
  });
}
