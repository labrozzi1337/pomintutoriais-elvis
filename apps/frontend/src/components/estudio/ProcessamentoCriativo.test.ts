import { expect, it } from "vitest";
import { moverCobrinha } from "./cobrinha";

it("atravessa a borda e reaparece do outro lado", () => {
  const corpo = [{ x: 15, y: 2 }, { x: 14, y: 2 }];
  const resultado = moverCobrinha(corpo, "direita", { x: 0, y: 2 });
  expect(resultado.comeu).toBe(true);
  expect(resultado.corpo[0]).toEqual({ x: 0, y: 2 });
  expect(resultado.colidiu).toBe(false);
});

it("atravessa também as bordas verticais", () => {
  const resultado = moverCobrinha([{ x: 4, y: 0 }], "cima", { x: 10, y: 10 });
  expect(resultado.corpo[0]).toEqual({ x: 4, y: 11 });
  expect(resultado.colidiu).toBe(false);
});

it("cresce sem encerrar quando come dentro da arena", () => {
  const corpo = [{ x: 5, y: 2 }, { x: 4, y: 2 }];
  const resultado = moverCobrinha(corpo, "direita", { x: 6, y: 2 });
  expect(resultado.comeu).toBe(true);
  expect(resultado.corpo).toHaveLength(3);
  expect(resultado.colidiu).toBe(false);
});
