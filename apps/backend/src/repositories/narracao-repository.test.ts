import { expect, it } from "vitest";
import { garantirVozesConfiguradas } from "./narracao-repository";

it("usa a nova referência como principal e mantém a anterior como alternativa", async () => {
  const inseridas: Array<{ nome: string; referencia_externa: string }> = [];
  const cliente = {
    from: () => ({
      upsert: (entrada: { nome: string; referencia_externa: string }) => ({
        select: () => ({
          single: () => {
            inseridas.push(entrada);
            return Promise.resolve({ data: { ...entrada, id: `voz-${inseridas.length}` }, error: null });
          }
        })
      })
    })
  } as never;

  const resultado = await garantirVozesConfiguradas(cliente, "nova", "anterior", "s2.1-pro-free");

  expect(inseridas).toMatchObject([
    { nome: "Erick Pomin", referencia_externa: "nova" },
    { nome: "Voz Feminina", referencia_externa: "anterior" }
  ]);
  expect(resultado.padrao?.id).toBe("voz-1");
});

it("mantém compatibilidade usando a voz anterior quando a principal não existe", async () => {
  const cliente = {
    from: () => ({ upsert: (entrada: object) => ({ select: () => ({ single: () => Promise.resolve({ data: { ...entrada, id: "voz-1" }, error: null }) }) }) })
  } as never;

  const resultado = await garantirVozesConfiguradas(cliente, undefined, "anterior", "s2.1-pro-free");
  expect(resultado.vozes).toHaveLength(1);
  expect(resultado.padrao?.nome).toBe("Erick Pomin");
});
