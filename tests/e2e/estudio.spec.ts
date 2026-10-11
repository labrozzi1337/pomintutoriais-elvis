import { expect, test } from "@playwright/test";

test("importar, editar, narrar com provedor simulado e baixar; retomar após refresh", async ({ page }) => {
  const projetoId = "00000000-0000-4000-8000-000000000001";
  const videoId = "00000000-0000-4000-8000-000000000002";
  const roteiroId = "00000000-0000-4000-8000-000000000003";
  const arquivoId = "00000000-0000-4000-8000-000000000004";
  const empresaId = "00000000-0000-4000-8000-000000000005";
  const areaId = "00000000-0000-4000-8000-000000000006";
  const data = new Date().toISOString();
  const session = { access_token: "token-simulado-somente-teste", refresh_token: "refresh-teste", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: projetoId, email: "teste@example.invalid", aud: "authenticated", role: "authenticated" } };
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: session }));
  let importado = false;
  let projetoCriado: unknown;
  const projeto = { id: projetoId, titulo: "Tutorial E2E", empresa: "Empresa E2E", setor: "Financeiro", status: "roteiro_pronto", criado_em: data, videos: [{ id: videoId, nome_original: "teste.mp4", status: "pronto", duracao_ms: 135600, tamanho_bytes: 100 }], processamentos: [] as unknown[] };
  let roteiro = { id: roteiroId, versao: 1, atualizado_em: data, modelo: "gpt-6.1-sol", historico: [], arquivosGerados: [] as unknown[], blocos: Array.from({ length: 16 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(10 + i).padStart(12, "0")}`, ordem: i, inicio_ms: i * 8475, fim_ms: (i + 1) * 8475, duracaoDisponivelMs: 8475, acao_visual: `Cena ${i + 1}`, narracao: "Abra o menu.", evidencias_frame: [], confianca: 0.9, narracaoGerada: null })) };
  let narracaoSolicitada: unknown;
  const origensApi = new Set<string>();
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(), caminho = new URL(request.url()).pathname;
    origensApi.add(new URL(request.url()).origin);
    if (caminho.endsWith("/configuracoes")) return route.fulfill({ json: { data: { vozes: [], limiteBytes: 524288000, limiteDuracaoMs: 900000, modeloPadrao: "gpt-6.1-sol", retencao: "Teste" } } });
    if (caminho.endsWith("/organizacao")) return route.fulfill({ json: { data: [{ id: empresaId, nome: "Empresa E2E", areas: [{ id: areaId, empresa_id: empresaId, nome: "Financeiro" }] }] } });
    if (caminho === "/api/v1/projetos") { if (request.method() === "POST") projetoCriado = request.postDataJSON(); return route.fulfill({ json: request.method() === "POST" ? { data: { id: projetoId } } : { data: importado ? [projeto] : [] } }); }
    if (caminho.endsWith("/uploads")) return route.fulfill({ json: { data: { uploadId: arquivoId, tamanhoParte: 5242880 } } });
    if (caminho.includes("/uploads/")) { importado = true; return route.fulfill({ json: { data: {} } }); }
    if (caminho.endsWith("/roteiro")) return route.fulfill({ json: { data: roteiro } });
    if (caminho.endsWith("/blocos")) {
      const entrada = request.postDataJSON() as { blocos: Array<{ id: string; inicioMs: number; fimMs: number; narracao: string; acaoVisual: string }> };
      roteiro = { ...roteiro, atualizado_em: new Date(Date.now() + 1000).toISOString(), blocos: entrada.blocos.map((bloco, i) => ({ ...roteiro.blocos[i]!, id: bloco.id, inicio_ms: bloco.inicioMs, fim_ms: bloco.fimMs, narracao: bloco.narracao, acao_visual: bloco.acaoVisual })) };
      return route.fulfill({ json: { data: roteiro } });
    }
    if (caminho.endsWith("/narracoes")) {
      narracaoSolicitada = request.postDataJSON();
      roteiro.arquivosGerados = [{ id: arquivoId, tipo: "video_final", mime_type: "video/mp4", criado_em: data }];
      return route.fulfill({ status: 202, json: { data: {} } });
    }
    if (caminho.endsWith("/acessos")) return route.fulfill({ status: 201, json: { data: { url: `/api/v1/arquivos/${arquivoId}/conteudo`, expiraEm: data } } });
    if (caminho.endsWith("/conteudo")) return route.fulfill({ body: Buffer.from("arquivo-simulado-somente-testes"), headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=teste.mp4" } });
    return route.fulfill({ status: 500, json: { error: { message: `Rota não simulada: ${caminho}` } } });
  });
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Criar novo vídeo" }).click();
  await page.getByRole("button", { name: "Já tenho o vídeo" }).click();
  await page.getByLabel("Empresa", { exact: true }).selectOption(empresaId);
  await page.getByLabel("Área", { exact: true }).selectOption(areaId);
  await page.locator('input[type="file"]').setInputFiles({ name: "teste.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(100) });
  await page.getByRole("button", { name: "Enviar e continuar", exact: true }).click();
  expect(projetoCriado).toMatchObject({ empresaId, areaId });
  await expect(page.getByText("Cena 1 de 16", { exact: true })).toBeVisible();
  await page.getByLabel("Narração", { exact: true }).fill("Texto revisado.");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByLabel("Narração", { exact: true })).toHaveValue("Texto revisado.");
  await page.getByLabel("Autorizo o processamento", { exact: false }).check();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Gerar / refazer vídeo", exact: true }).click();
  await expect(page.getByRole("button", { name: /^MP4 ·/ })).toBeVisible();
  expect(narracaoSolicitada).toMatchObject({ confirmarCustos: true, gerarLegendas: true, ajustarTextoAutomaticamente: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /^MP4 ·/ }).click();
  expect((await download).suggestedFilename()).toBe("teste.mp4");
  await page.reload();
  await expect(page.getByLabel("Narração", { exact: true })).toHaveValue("Texto revisado.");
  await page.goto("/tutoriais");
  await expect(page.getByRole("heading", { name: "Empresa E2E" })).toBeVisible();
  await expect(page.getByText("Financeiro · 1", { exact: true })).toBeVisible();
  await page.getByLabel("Buscar tutorial").fill("financ");
  await expect(page.getByRole("option", { name: /Tutorial E2E/ })).toBeVisible();
  await expect(page.getByLabel("Miniatura de Tutorial E2E").first()).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Da gravação de tela ao tutorial pronto." })).toBeVisible();
  await expect(page.getByText("Tutorial E2E", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Biblioteca" })).toBeVisible();
  for (const menu of ["Grupo Pomin", "Auditto", "Solutta", "Alerta Fiscal"]) await expect(page.getByRole("link", { name: menu, exact: true })).toHaveCount(0);
  expect([...origensApi]).toEqual([new URL(page.url()).origin]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("explica quando uma rota da API devolve HTML", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000201";
  const session = { access_token: "token-html-somente-teste", refresh_token: "refresh-html", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id, email: "html@example.invalid", aud: "authenticated", role: "authenticated" } };
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: session }));
  await page.route("**/api/v1/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>rota errada</title>" }));
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("html@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("A API respondeu em formato inesperado");
});

test("gera roteiro e narração em um clique e oferece cobrinha durante a espera", async ({ page }) => {
  const projetoId = "00000000-0000-4000-8000-000000000401";
  const videoId = "00000000-0000-4000-8000-000000000402";
  const processamentoId = "00000000-0000-4000-8000-000000000403";
  const data = new Date().toISOString();
  const session = { access_token: "token-fluxo-somente-teste", refresh_token: "refresh-fluxo", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: projetoId, email: "fluxo@example.invalid", aud: "authenticated", role: "authenticated" } };
  let analise: unknown;
  let iniciado = false;
  const projeto = () => ({ id: projetoId, titulo: "Tutorial automático", empresa: "Empresa E2E", setor: "Operações", status: iniciado ? "analisando" : "recebido", criado_em: data, videos: [{ id: videoId, nome_original: "automatico.mp4", status: "pronto", duracao_ms: 60_000, tamanho_bytes: 100 }], processamentos: iniciado ? [{ id: processamentoId, tipo: "analisar_video", status: "analisando", progresso: 40, mensagem: "Analisando cenas com IA.", codigo_erro: null, configuracao: { narracao: { fluxoAutomatico: true } }, criado_em: data }] : [] });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: session }));
  await page.route("**/api/v1/**", (route) => {
    const request = route.request(), caminho = new URL(request.url()).pathname;
    if (caminho.endsWith("/configuracoes")) return route.fulfill({ json: { data: { vozes: [{ id: "00000000-0000-4000-8000-000000000404", nome: "Voz padrão", modelo: "s2.1-pro-free" }], limiteBytes: 524288000, limiteDuracaoMs: 900000, modeloPadrao: "gpt-6.1-sol", retencao: "Teste" } } });
    if (caminho.endsWith("/organizacao")) return route.fulfill({ json: { data: [] } });
    if (caminho === "/api/v1/projetos") return route.fulfill({ json: { data: [projeto()] } });
    if (caminho.endsWith("/roteiro")) return route.fulfill({ status: 404, json: { error: { message: "Roteiro não encontrado." } } });
    if (caminho.endsWith("/analises")) { analise = request.postDataJSON(); iniciado = true; return route.fulfill({ status: 202, json: { data: { id: processamentoId } } }); }
    return route.fulfill({ status: 404, json: { error: { message: "Rota não simulada." } } });
  });
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("fluxo@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar criação" }).click();
  await expect(page.getByText("Gerar roteiro + narração de uma vez", { exact: true })).toBeVisible();
  await page.getByLabel("Autorizo o processamento", { exact: false }).check();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Criar tutorial completo" }).click();
  expect(analise).toMatchObject({ narrarAoConcluir: true, confirmarCustos: true, tom: "conversado" });
  await expect(page.getByRole("heading", { name: "Pode deixar com a gente." })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Progresso da criação do tutorial" })).toHaveAttribute("value", "18");
  await page.getByRole("button", { name: "Quero bater meu recorde" }).click();
  await expect(page.getByLabel("Jogo da cobrinha")).toBeVisible();
});

test("usa Recordly como pré-requisito e só mostra seu download após falha", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000301";
  const session = { access_token: "token-launcher-somente-teste", refresh_token: "refresh-launcher", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id, email: "launcher@example.invalid", aud: "authenticated", role: "authenticated" } };
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }));
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: session }));
  await page.route("**/api/v1/**", (route) => {
    const caminho = new URL(route.request().url()).pathname;
    if (caminho === "/api/v1/projetos") return route.fulfill({ json: { data: [] } });
    if (caminho.endsWith("/configuracoes")) return route.fulfill({ json: { data: { vozes: [], limiteBytes: 524288000, limiteDuracaoMs: 900000, modeloPadrao: "gpt-6.1-sol", retencao: "Teste" } } });
    if (caminho.endsWith("/organizacao")) return route.fulfill({ json: { data: [] } });
    return route.fulfill({ status: 404, json: { error: { message: "Rota não simulada." } } });
  });
  await page.goto("/entrar");
  await page.getByLabel("E-mail", { exact: true }).fill("launcher@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Gravação desktop", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gravar no navegador" })).toHaveCount(0);
  await page.getByRole("button", { name: "Criar novo vídeo" }).click();
  await expect(page.getByRole("heading", { name: "Informe de onde vem o vídeo" })).toBeVisible();
  await page.getByRole("button", { name: "Ainda vou gravar" }).click();
  await expect(page.getByRole("link", { name: "Baixar Recordly" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir Recordly" }).click();
  await expect(page.getByRole("link", { name: "Baixar Recordly" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar integração Windows" })).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir Recordly" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(1900);
  await expect(page.getByRole("link", { name: "Baixar Recordly" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gravador aberto — agora grave seu vídeo" })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Já exportei o MP4" }).click();
  await expect(page.locator('input[type="file"]')).toBeVisible();
});
