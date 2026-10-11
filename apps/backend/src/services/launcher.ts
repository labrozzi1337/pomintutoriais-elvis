import { createHash } from "node:crypto";

export function hashLauncher(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function retornoLauncherValido(desafio: { status: string; expira_em: string; dispositivo_id: string; proprietario_id: string }, dispositivo: { id: string; proprietario_id: string; ativo: boolean }, agora = Date.now()): boolean {
  return dispositivo.ativo && desafio.status === "aguardando" && Date.parse(desafio.expira_em) > agora && desafio.dispositivo_id === dispositivo.id && desafio.proprietario_id === dispositivo.proprietario_id;
}
