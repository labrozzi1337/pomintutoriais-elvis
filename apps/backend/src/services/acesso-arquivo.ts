import { createHmac, timingSafeEqual } from "node:crypto";

interface AcessoArquivo {
  videoId: string;
  usuarioId: string;
  modo: "reproduzir" | "baixar";
  expiraEm: number;
}

/** Emite um token curto, escopado ao vídeo, modo e usuário autorizado. */
export function assinarAcesso(payload: AcessoArquivo, secret: string): string {
  const corpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${corpo}.${assinatura(corpo, secret)}`;
}

/** Valida assinatura, escopo e expiração sem confiar em parâmetros isolados da URL. */
export function validarAcesso(token: string, videoId: string, secret: string, agora = Date.now()): AcessoArquivo | null {
  const [corpo, recebido] = token.split(".");
  if (!corpo || !recebido) return null;
  const esperado = assinatura(corpo, secret);
  const recebidoBuffer = Buffer.from(recebido);
  const esperadoBuffer = Buffer.from(esperado);
  if (recebidoBuffer.length !== esperadoBuffer.length || !timingSafeEqual(recebidoBuffer, esperadoBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as AcessoArquivo;
    return payload.videoId === videoId && payload.expiraEm > agora ? payload : null;
  } catch {
    return null;
  }
}

/** Produz HMAC SHA-256 em formato seguro para URL. */
function assinatura(corpo: string, secret: string): string {
  return createHmac("sha256", secret).update(corpo).digest("base64url");
}
