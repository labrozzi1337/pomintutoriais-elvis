import { z } from "zod";

const serverEnvSchema = z.object({
  START_BACK_SUPABASE_URL: z.url(),
  START_BACK_SUPABASE_ANON_KEY: z.string().min(20),
  START_BACK_SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  START_BACK_ALLOWED_ORIGINS: z.string().default("http://localhost:8081"),
  START_BACK_REDIS_URL: z.url().default("redis://localhost:6379"),
  START_BACK_STORAGE_ROOT: z.string().min(1).default("./data/estudio"),
  START_BACK_DOWNLOAD_SECRET: z.string().min(32),
  START_BACK_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(524_288_000),
  START_BACK_MAX_VIDEO_DURATION_MS: z.coerce.number().int().positive().default(900_000),
  START_BACK_UPLOAD_CHUNK_BYTES: z.coerce.number().int().min(1_048_576).max(25_165_824).default(5_242_880),
  OPENAI_API_KEY: z.string().min(20).optional(),
  START_BACK_OPENAI_MODEL: z.enum(["gpt-6.1-sol", "gpt-6-astra"]).default("gpt-6.1-sol"),
  START_BACK_MAX_ANALYSIS_FRAMES: z.coerce.number().int().min(10).max(120).default(120),
  FISH_API_KEY: z.string().min(20).optional(),
  FISH_VOICE_ID_PRIMARY: z.string().min(1).optional(),
  FISH_VOICE_ID: z.string().min(1).optional(),
  START_BACK_FISH_MODEL: z.enum(["s2.1-pro-free", "s2.1-pro"]).default("s2.1-pro-free"),
  START_BACK_FISH_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2)
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Valida a configuração privada usada pela API e pelo worker. */
export function getServerEnv(): { ok: true; data: ServerEnv } | { ok: false; issues: string[] } {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((issue) => issue.path.join("."))
    };
  }

  return { ok: true, data: result.data };
}

/** Retorna somente as origens autorizadas a chamar a API pelo navegador. */
export function getAllowedOrigins(): string[] {
  return (process.env.START_BACK_ALLOWED_ORIGINS ?? "http://localhost:8081")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

