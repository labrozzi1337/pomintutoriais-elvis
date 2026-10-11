import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { log } from "@/lib/logger";

export type ApiErrorCode =
  | "AUTH_REQUIRED" | "FORBIDDEN" | "CONFIGURATION_ERROR" | "VALIDATION_ERROR" | "NOT_FOUND"
  | "CONFLICT" | "UPLOAD_INVALID" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE";

/** Padroniza erros HTTP sem vazar detalhes internos. */
export function respostaErro(code: ApiErrorCode, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status });
}

/** Lê e valida JSON externo, convertendo falhas em erro de validação seguro. */
export async function lerJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  try {
    return schema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) throw error;
    throw new ZodError([{ code: "custom", path: [], message: "JSON inválido." }]);
  }
}

/** Extrai somente os detalhes de validação apropriados para o cliente. */
export function detalhesZod(error: ZodError): Array<{ campo: string; mensagem: string }> {
  return error.issues.map((issue) => ({ campo: issue.path.join("."), mensagem: issue.message }));
}

/** Converte exceções de rota em respostas seguras e logs correlacionados. */
export function tratarExcecao(error: unknown, requestId: string): NextResponse {
  if (error instanceof ZodError) return respostaErro("VALIDATION_ERROR", "Revise os dados enviados.", 400, detalhesZod(error));
  log("error", "Falha não tratada na API.", { event: "api.unhandled_error", requestId, errorCode: error instanceof Error ? error.message : "UNKNOWN" });
  return respostaErro("INTERNAL_ERROR", "Não foi possível concluir a operação.", 500);
}
