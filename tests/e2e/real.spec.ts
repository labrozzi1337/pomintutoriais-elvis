import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("real: login autorizado, reabrir roteiro, reproduzir e baixar MP4 existente", async ({ page, request }) => {
  test.skip(!process.env.E2E_EMAIL, "Defina E2E_EMAIL e as variáveis de servidor somente no ambiente de testes.");
  const url = process.env.START_BACK_SUPABASE_URL!;
  const anon = process.env.START_BACK_SUPABASE_ANON_KEY!;
  const admin = createClient(url, process.env.START_BACK_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.E2E_EMAIL! });
  if (link.error) throw new Error("E2E_LOGIN_LINK_FAILED");
  const auth = createClient(url, anon, { auth: { persistSession: false } });
  const resultado = await auth.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (resultado.error || !resultado.data.session) throw new Error("E2E_LOGIN_FAILED");
  const session = resultado.data.session;
  const respostasMedia: Array<{ status: number; tipo: string | undefined }> = [];
  page.on("response", (resposta) => { if (/\/(conteudo|acessos)$/.test(new URL(resposta.url()).pathname)) respostasMedia.push({ status: resposta.status(), tipo: resposta.headers()["content-type"] }); });
  let etapa = "lista";
  try {
  await page.addInitScript(({ key, valor }) => localStorage.setItem(key, valor), { key: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`, valor: JSON.stringify(session) });
  const lista = await request.get("/api/v1/projetos", { headers: { Authorization: `Bearer ${session.access_token}` } });
  expect(lista.status()).toBe(200);
  const dados = await lista.json() as { data: Array<{ id: string; processamentos: Array<{ status: string }> }> };
  const projeto = dados.data.find((item) => item.processamentos.some((job) => job.status === "concluido"));
  expect(projeto).toBeTruthy();
  etapa = "editor";
  await page.goto(`/tutoriais?projeto=${projeto!.id}`);
  await expect(page.getByRole("heading", { name: "Narrar vídeo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resultado validado", exact: true }).click();
  etapa = "player";
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState), { timeout: 15000 }).toBeGreaterThanOrEqual(1);
  const download = page.waitForEvent("download");
  etapa = "download";
  await page.getByRole("button", { name: /^MP4 ·/ }).first().click();
  const baixado = await download;
  expect(baixado.suggestedFilename()).toBe("tutorial-narrado.mp4");
  expect(await baixado.failure()).toBeNull();
  await page.reload();
  etapa = "reabrir";
  await expect(page.getByRole("heading", { name: "Narrar vídeo", exact: true })).toBeVisible();
  const desautorizado = await request.get("/api/v1/projetos");
  etapa = "autorizacao";
  expect(desautorizado.status()).toBe(401);
  const origem = await request.get("/api/v1/projetos", { headers: { Origin: "https://nao-autorizado.invalid", Authorization: `Bearer ${session.access_token}` } });
  expect(origem.status()).toBe(403);
  } catch {
    if (etapa === "player") console.log(JSON.stringify({ respostasMedia, alertas: await page.getByRole("alert").allTextContents(), player: await page.locator("video").evaluate((video: HTMLVideoElement) => ({ temSrc: video.hasAttribute("src"), readyState: video.readyState, networkState: video.networkState, erro: video.error?.code, h264: video.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"') })) }));
    throw new Error(`E2E_REAL_FAILED:${etapa}`);
  } finally { await auth.auth.signOut({ scope: "local" }); }
});
