import Redis from "ioredis";

/** Serializa escritas da timeline entre instâncias da API, sem funções no banco. */
export async function comLockEdicao<T>(redisUrl: string, roteiroId: string, editar: () => Promise<T>): Promise<T> {
  const redis = new Redis(redisUrl, { connectTimeout: 2000, maxRetriesPerRequest: 0 });
  redis.on("error", () => undefined);
  const chave = `estudio:edicao:${roteiroId}`, token = crypto.randomUUID();
  let adquirido = false;
  let renovacao: ReturnType<typeof setInterval> | undefined;
  try {
    adquirido = await redis.set(chave, token, "EX", 120, "NX") === "OK";
    if (!adquirido) throw new Error("SCRIPT_EDIT_CONFLICT");
    // shortcut: a compensação não é transação SQL; revisar antes de liberar edição colaborativa.
    renovacao = setInterval(() => { void redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('expire',KEYS[1],120) end return 0", 1, chave, token).catch(() => undefined); }, 30000);
    return await editar();
  } finally {
    if (renovacao) clearInterval(renovacao);
    try { if (adquirido) await redis.eval("if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) end return 0", 1, chave, token); }
    finally { redis.disconnect(); }
  }
}
