export type SistemaRecordly = "windows" | "macos" | "linux" | "desconhecido";
export const urlAberturaRecordly = "estudiotutoriais://abrir";

export function detectarSistemaRecordly(userAgent: string, platform = "", touchPoints = 0): SistemaRecordly {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && touchPoints > 1)) return "desconhecido";
  const identificacao = `${platform} ${userAgent}`;
  if (/Windows|Win32|Win64/i.test(identificacao)) return "windows";
  if (/Mac/i.test(identificacao)) return "macos";
  if (/Linux/i.test(identificacao)) return "linux";
  return "desconhecido";
}

const release = "https://github.com/webadderallorg/Recordly/releases/download/v1.4.0/";
export const downloadsRecordly = {
  windows: [{ nome: "Windows · Instalador x64 · 177 MB", url: `${release}Recordly-windows-x64.exe` }],
  macos: [
    { nome: "Apple Silicon (M1/M2/M3/M4) · DMG · 179 MB", url: `${release}Recordly-arm64.dmg` },
    { nome: "Apple Silicon · ZIP · 172 MB", url: `${release}Recordly-arm64.zip` },
    { nome: "Intel · DMG · 190 MB", url: `${release}Recordly-x64.dmg` },
    { nome: "Intel · ZIP · 183 MB", url: `${release}Recordly-x64.zip` }
  ],
  linux: [{ nome: "Linux · AppImage x64 · 195 MB", url: `${release}Recordly-linux-x64.AppImage` }]
};
