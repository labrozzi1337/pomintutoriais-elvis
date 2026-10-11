import { expect, it } from "vitest";
import { registrarRecorde } from "./recordes-repository";

it("preserva o maior score da conta ao registrar uma partida menor", async () => {
  let gravado: { proprietario_id: string; nickname: string; score: number } | undefined;
  const cliente = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { score: 500 }, error: null }) }) }),
      upsert: (entrada: typeof gravado) => {
        gravado = entrada;
        return { select: () => ({ single: () => Promise.resolve({ data: entrada, error: null }) }) };
      }
    })
  } as never;

  await registrarRecorde(cliente, "usuario", "PLAYER", 200);
  expect(gravado).toMatchObject({ proprietario_id: "usuario", nickname: "PLAYER", score: 500 });
});
