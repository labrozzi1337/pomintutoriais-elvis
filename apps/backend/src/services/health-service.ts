import Redis from "ioredis";
import type { ServerSupabaseClient } from "@/integrations/supabase/server";

export type DatabaseStatus = "connected" | "unavailable";
export type RedisStatus = "connected" | "unavailable";

/** Verifica se o schema dedicado responde sem alterar dados. */
export async function checkDatabase(client: ServerSupabaseClient): Promise<DatabaseStatus> {
  try {
    const { error } = await client.from("app_metadata").select("key", { head: true, count: "exact" });
    return error ? "unavailable" : "connected";
  } catch {
    return "unavailable";
  }
}

/** Verifica Redis com timeout curto e sempre fecha a conexão de diagnóstico. */
export async function checkRedis(redisUrl: string): Promise<RedisStatus> {
  const redis = new Redis(redisUrl, { connectTimeout: 2_000, maxRetriesPerRequest: 0, lazyConnect: true });
  redis.on("error", () => undefined);
  try {
    await redis.connect();
    return await redis.ping() === "PONG" ? "connected" : "unavailable";
  } catch {
    return "unavailable";
  } finally {
    redis.disconnect();
  }
}

