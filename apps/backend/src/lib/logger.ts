type LogLevel = "info" | "warn" | "error";

interface LogContext {
  event: string;
  requestId?: string;
  errorCode?: string;
  projetoId?: string;
  processamentoId?: string;
  roteiroId?: string;
}

/** Emite logs JSON correlacionáveis sem incluir segredos ou dados pessoais. */
export function log(level: LogLevel, message: string, context: LogContext): void {
  const codigo = context.errorCode?.split(":")[0];
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...(context.errorCode ? { errorCode: codigo && /^[A-Z][A-Z0-9_]{0,80}$/.test(codigo) ? codigo : "UNEXPECTED_ERROR" } : {})
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

