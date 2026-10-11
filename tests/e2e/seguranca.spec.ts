import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("real: isolamento RLS, edição de timeline e limites, sem chamadas pagas", async ({ request }) => {
  test.skip(!process.env.E2E_EMAIL, "Teste real opt-in com credenciais somente no ambiente.");
  const url = process.env.START_BACK_SUPABASE_URL!;
  const admin = createClient(url, process.env.START_BACK_SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "tutoriais" }, auth: { persistSession: false } });
  const auth = createClient(url, process.env.START_BACK_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const projetoId = randomUUID(), arquivoId = randomUUID(), videoId = randomUUID(), roteiroId = randomUUID();
  const email = `e2e-${randomUUID()}@example.invalid`, password = `${randomUUID()}Aa!`;
  let usuarioId: string | undefined;
  let etapa = "fixture";
  const conferir = (erro: unknown) => { if (erro) throw new Error("E2E_FIXTURE_FAILED"); };
  try {
    const criado = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    conferir(criado.error); usuarioId = criado.data.user!.id;
    const login = await auth.auth.signInWithPassword({ email, password });
    conferir(login.error);
    const headers = { Authorization: `Bearer ${login.data.session!.access_token}` };
    conferir((await admin.from("projetos").insert({ id: projetoId, proprietario_id: usuarioId, titulo: "Fixture temporária de aceite E2E" })).error);
    conferir((await admin.from("arquivos").insert({ id: arquivoId, projeto_id: projetoId, tipo: "video_original", chave_armazenamento: `projetos/${projetoId}/originais/fixture.mp4`, mime_type: "video/mp4", tamanho_bytes: 100 })).error);
    conferir((await admin.from("videos").insert({ id: videoId, projeto_id: projetoId, arquivo_original_id: arquivoId, nome_original: "fixture.mp4", mime_type: "video/mp4", tamanho_bytes: 100, duracao_ms: 135600, status: "pronto" })).error);
    conferir((await admin.from("roteiros").insert({ id: roteiroId, projeto_id: projetoId, versao: 1, status: "pronto", modelo: "fixture-sem-provedor" })).error);
    const blocos = Array.from({ length: 16 }, (_, ordem) => ({ id: randomUUID(), roteiro_id: roteiroId, ordem, inicio_ms: ordem * 8475, fim_ms: (ordem + 1) * 8475, narracao: "Texto de teste.", acao_visual: "Cena de teste", evidencias_frame: [], confianca: 1 }));
    conferir((await admin.from("blocos").insert(blocos)).error);
    etapa = "IDOR";
    const estrangeiro = await admin.from("projetos").select("id").neq("proprietario_id", usuarioId).limit(1).single();
    conferir(estrangeiro.error);
    expect((await request.get(`/api/v1/projetos/${estrangeiro.data!.id}`, { headers })).status()).toBe(404);
    const videoEstrangeiro = await admin.from("videos").select("id").eq("projeto_id", estrangeiro.data!.id).limit(1).single();
    conferir(videoEstrangeiro.error);
    expect((await request.post(`/api/v1/videos/${videoEstrangeiro.data!.id}/acessos`, { headers, data: { modo: "baixar" } })).status()).toBe(404);
    expect((await request.get(`/api/v1/videos/${videoEstrangeiro.data!.id}/conteudo`)).status()).toBe(401);
    const arquivoEstrangeiro = await admin.from("arquivos").select("id").eq("projeto_id", estrangeiro.data!.id).eq("tipo", "video_final").limit(1).single();
    conferir(arquivoEstrangeiro.error);
    expect((await request.post(`/api/v1/arquivos/${arquivoEstrangeiro.data!.id}/acessos`, { headers, data: { modo: "baixar" } })).status()).toBe(404);
    const forjado = randomUUID();
    conferir((await auth.schema("tutoriais").from("arquivos").insert({ id: forjado, projeto_id: projetoId, tipo: "video_final", chave_armazenamento: `projetos/${projetoId}/forjado.html`, mime_type: "text/html", tamanho_bytes: 100 })).error);
    expect((await request.post(`/api/v1/arquivos/${forjado}/acessos`, { headers, data: { modo: "reproduzir" } })).status()).toBe(404);
    etapa = "limites";
    expect((await request.post(`/api/v1/projetos/${projetoId}/uploads`, { headers, data: { nomeArquivo: "enorme.mp4", mimeType: "video/mp4", tamanhoBytes: 1e12 } })).status()).toBe(413);
    expect((await request.post(`/api/v1/projetos/${projetoId}/uploads`, { headers, data: { nomeArquivo: "programa.exe", mimeType: "video/mp4", tamanhoBytes: 100 } })).status()).toBe(415);
    etapa = "timeline";
    const obter = async () => (await (await request.get(`/api/v1/projetos/${projetoId}/roteiro`, { headers })).json()).data as { atualizado_em: string; blocos: Array<{ id: string; inicio_ms: number; fim_ms: number; narracao: string; acao_visual: string }> };
    const antes = await obter();
    const entrada = antes.blocos.map((bloco) => ({ id: bloco.id, inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, narracao: bloco.narracao, acaoVisual: bloco.acao_visual, evidenciasFrame: [], confianca: 1 }));
    const meio = Math.floor(entrada[0]!.fimMs / 2);
    const divididos = [{ ...entrada[0]!, fimMs: meio }, { ...entrada[0]!, id: undefined, inicioMs: meio }, ...entrada.slice(1)];
    expect((await request.put(`/api/v1/roteiros/${roteiroId}/blocos`, { headers, data: { atualizadoEm: antes.atualizado_em, blocos: divididos } })).status()).toBe(200);
    const depois = await obter(); expect(depois.blocos).toHaveLength(17);
    expect((await request.put(`/api/v1/roteiros/${roteiroId}/blocos`, { headers, data: { atualizadoEm: antes.atualizado_em, blocos: entrada } })).status()).toBe(409);
    expect((await request.put(`/api/v1/roteiros/${roteiroId}/blocos`, { headers, data: { atualizadoEm: depois.atualizado_em, blocos: entrada } })).status()).toBe(200);
    expect((await obter()).blocos).toHaveLength(16);
    etapa = "exclusao";
    expect((await request.delete(`/api/v1/projetos/${projetoId}`, { headers })).status()).toBe(204);
  } catch { throw new Error(`E2E_SECURITY_FAILED:${etapa}`); }
  finally {
    await auth.auth.signOut({ scope: "local" });
    // Exclui somente a fixture identificada acima, nunca projetos preexistentes.
    conferir((await admin.from("videos").delete().eq("projeto_id", projetoId)).error);
    conferir((await admin.from("projetos").delete().eq("id", projetoId)).error);
    if (usuarioId) conferir((await admin.auth.admin.deleteUser(usuarioId)).error);
  }
});
