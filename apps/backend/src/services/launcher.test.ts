import { expect, it } from "vitest";
import { retornoLauncherValido } from "./launcher";

it("rejeita replay, expiração, dispositivo revogado e outra sessão/proprietário", () => {
  const desafio = { status: "aguardando", expira_em: "2026-10-09T23:00:00Z", dispositivo_id: "d", proprietario_id: "u" };
  const dispositivo = { id: "d", proprietario_id: "u", ativo: true };
  const agora = Date.parse("2026-10-09T22:59:00Z");
  expect(retornoLauncherValido(desafio, dispositivo, agora)).toBe(true);
  expect(retornoLauncherValido({ ...desafio, status: "aberto" }, dispositivo, agora)).toBe(false);
  expect(retornoLauncherValido(desafio, dispositivo, agora + 60000)).toBe(false);
  expect(retornoLauncherValido(desafio, { ...dispositivo, ativo: false }, agora)).toBe(false);
  expect(retornoLauncherValido(desafio, { ...dispositivo, proprietario_id: "outro" }, agora)).toBe(false);
  expect(retornoLauncherValido(desafio, { ...dispositivo, id: "outro" }, agora)).toBe(false);
});
