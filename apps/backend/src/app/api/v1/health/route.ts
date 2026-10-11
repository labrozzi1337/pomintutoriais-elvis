import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { log } from "@/lib/logger";
import { checkDatabase, checkRedis } from "@/services/health-service";

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

  const [database, redis] = await Promise.all([
    checkDatabase(createServerSupabaseClient(env.data)),
    checkRedis(env.data.START_BACK_REDIS_URL)
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

  const healthy = database === "connected" && redis === "connected";
  return NextResponse.json({
    data: healthData(healthy ? "ok" : "degraded", database, redis),
    meta: { requestId }
  }, { status: healthy ? 200 : 503 });
}

/** Monta o contrato estável do health check da API, banco e fila. */
function healthData(
  status: "ok" | "degraded",
  database: "connected" | "unconfigured" | "unavailable",
  redis: "connected" | "unavailable"
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

