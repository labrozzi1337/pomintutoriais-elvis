import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { log } from "@/lib/logger";
import { checkDatabase, checkRedis } from "@/services/health-service";
import { ArmazenamentoB2, b2Configurada } from "@/services/b2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const env = getServerEnv();

  if (!env.ok) {
    log("warn", "Configuração do Supabase ausente ou inválida.", {
      event: "health.database_unconfigured",
      requestId
    });

    return NextResponse.json({
      data: healthData("degraded", "unconfigured", "unavailable"),
      meta: { requestId }
    }, { status: 503 });
  }

  const vercel = process.env.VERCEL === "1";
  const [database, redis, storage] = await Promise.all([
    checkDatabase(createServerSupabaseClient(env.data)),
    vercel ? Promise.resolve("not_required" as const) : checkRedis(env.data.START_BACK_REDIS_URL),
    checkStorage()
  ]);

  if (database === "unavailable") {
    log("error", "Não foi possível consultar o schema da aplicação.", {
      event: "health.database_unavailable",
      requestId,
      errorCode: "DATABASE_UNAVAILABLE"
    });
  }

  if (redis === "unavailable") {
    log("error", "Não foi possível consultar o Redis.", { event: "health.redis_unavailable", requestId, errorCode: "REDIS_UNAVAILABLE" });
  }

  const healthy = database === "connected" && redis !== "unavailable" && storage !== "unavailable";
  return NextResponse.json({
    data: { ...healthData(healthy ? "ok" : "degraded", database, redis), storage, processing: vercel ? "vercel-workflow" : "bullmq" },
    meta: { requestId }
  }, { status: healthy ? 200 : 503 });
}

/** Monta o contrato estável do health check da API, banco e fila. */
function healthData(
  status: "ok" | "degraded",
  database: "connected" | "unconfigured" | "unavailable",
  redis: "connected" | "unavailable" | "not_required"
) {
  return {
    service: "start-back-api" as const,
    status,
    database,
    redis,
    schema: "tutoriais" as const,
    timestamp: new Date().toISOString()
  };
}

async function checkStorage(): Promise<"connected" | "local" | "unavailable"> {
  try {
    if (!b2Configurada()) return "local";
    await new ArmazenamentoB2().metadados(".health");
    return "connected";
  } catch { return "unavailable"; }
}

