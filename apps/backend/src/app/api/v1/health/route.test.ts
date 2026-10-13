import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { checkRedis } from "@/services/health-service";

vi.mock("@/config/env", () => ({ getServerEnv: () => ({ ok: true, data: { START_BACK_REDIS_URL: "redis://localhost:6379" } }) }));
vi.mock("@/integrations/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/services/health-service", () => ({ checkDatabase: () => "connected", checkRedis: vi.fn(() => "connected") }));
const storage = vi.hoisted(() => ({ metadados: vi.fn() }));
vi.mock("@/services/b2", () => ({ b2Configurada: () => true, ArmazenamentoB2: class { metadados = storage.metadados; } }));

describe("health na Vercel", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
  it("verifica B2 sem exigir Redis em produção", async () => {
    vi.stubEnv("VERCEL", "1");
    storage.metadados.mockResolvedValue(null);
    const response = await GET(new Request("https://example.com/api/v1/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { redis: "not_required", storage: "connected", processing: "vercel-workflow" } });
    expect(checkRedis).not.toHaveBeenCalled();
  });
  it("não oculta uma falha de armazenamento", async () => {
    vi.stubEnv("VERCEL", "1");
    storage.metadados.mockRejectedValue(new Error("STORAGE_UNAVAILABLE"));
    expect((await GET(new Request("https://example.com/api/v1/health"))).status).toBe(503);
  });
});
