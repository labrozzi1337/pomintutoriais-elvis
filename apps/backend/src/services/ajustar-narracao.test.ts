import { expect, it, vi } from "vitest";
import { ajustarNarracao } from "./ajustar-narracao";

it("preserva blocos válidos e tenta no máximo duas reescritas no bloco longo", async () => {
  const reescrever = vi.fn((texto: string) => Promise.resolve(texto.slice(0, -1)));
  const gerar = vi.fn((texto: string) => Promise.resolve({ texto, duracaoMs: 1500 }));
  const valido = { texto: "ok", duracaoMs: 1120 };
  expect(await ajustarNarracao(valido, 1000, reescrever, gerar)).toBe(valido);
  expect(gerar).not.toHaveBeenCalled();
  await ajustarNarracao({ texto: "texto longo", duracaoMs: 1600 }, 1000, reescrever, gerar);
  expect(gerar).toHaveBeenCalledTimes(2);
});
