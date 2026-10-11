import { expect, it } from "vitest";
import { comLockEdicao } from "./lock-edicao";

it.skipIf(!process.env.TEST_REDIS_URL)("Redis real: bloqueia escrita concorrente e libera após falha", async () => {
  const url = process.env.TEST_REDIS_URL!, id = crypto.randomUUID();
  await comLockEdicao(url, id, async () => { await expect(comLockEdicao(url, id, () => Promise.resolve())).rejects.toThrow("SCRIPT_EDIT_CONFLICT"); });
  await expect(comLockEdicao(url, id, () => Promise.reject(new Error("FALHA_TESTE")))).rejects.toThrow("FALHA_TESTE");
  await expect(comLockEdicao(url, id, () => Promise.resolve("liberado"))).resolves.toBe("liberado");
});
