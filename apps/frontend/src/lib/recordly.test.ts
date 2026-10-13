import { describe, expect, it } from "vitest";
import { detectarSistemaRecordly, downloadsRecordly, urlAberturaRecordly } from "./recordly";

describe("Recordly", () => {
  it("solicita somente a abertura do aplicativo, sem rota do portal", () => {
    expect(urlAberturaRecordly).toBe("estudiotutoriais://abrir");
  });
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0, "windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0, "macos"],
    ["Mozilla/5.0 (X11; Linux x86_64)", "Linux x86_64", 0, "linux"],
    ["Mozilla/5.0 (Linux; Android 14)", "Linux", 5, "desconhecido"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X)", "MacIntel", 5, "desconhecido"],
    ["Mozilla/5.0 (iPhone)", "iPhone", 5, "desconhecido"],
    ["", "", 0, "desconhecido"]
  ])("identifica %s", (ua, platform, touch, esperado) => {
    expect(detectarSistemaRecordly(ua, platform, touch)).toBe(esperado);
  });
  it("oferece os seis arquivos oficiais, sem inferir o processador do Mac pelo user agent", () => {
    const arquivos = Object.values(downloadsRecordly).flat();
    expect(arquivos).toHaveLength(6);
    expect(new Set(arquivos.map(({ url }) => url)).size).toBe(6);
    for (const { url } of arquivos) expect(url).toMatch(/^https:\/\/github\.com\/webadderallorg\/Recordly\/releases\/download\/v1\.4\.0\/Recordly-.+\.(exe|dmg|zip|AppImage)$/);
    expect(downloadsRecordly.macos).toHaveLength(4);
  });
});
