import { describe, expect, it } from "vitest";
import { interpretarRange } from "@/services/http-range";

describe("intervalos de reprodução", () => {
  it("limita o fim ao tamanho do arquivo", () => {
    expect(interpretarRange("bytes=10-999", 100)).toEqual({ inicio: 10, fim: 99 });
  });

  it("aceita sufixo e rejeita início fora do arquivo", () => {
    expect(interpretarRange("bytes=-20", 100)).toEqual({ inicio: 80, fim: 99 });
    expect(interpretarRange("bytes=100-", 100)).toBe("invalido");
  });
});
