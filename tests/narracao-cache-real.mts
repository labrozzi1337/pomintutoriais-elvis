import { createClient } from "@supabase/supabase-js";
import { access } from "node:fs/promises";
import path from "node:path";
import { hashNarracao, type ModeloFish } from "../apps/backend/src/services/fish-audio";

const url = process.env.START_BACK_SUPABASE_URL!;
const admin = createClient(url, process.env.START_BACK_SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: "tutoriais" }, auth: { persistSession: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email: process.env.E2E_EMAIL! });
if (link.error) throw new Error("TEST_LOGIN_LINK_FAILED");
const auth = createClient(url, process.env.START_BACK_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const login = await auth.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
if (login.error || !login.data.session) throw new Error("TEST_LOGIN_FAILED");
const token = login.data.session.access_token;
const roteiro = await admin.from("roteiros").select("id,projeto_id").eq("status", "pronto").order("criado_em", { ascending: false }).limit(1).single();
if (roteiro.error) throw new Error("TEST_SCRIPT_MISSING");
const blocos = await admin.from("blocos").select("narracao").eq("roteiro_id", roteiro.data.id);
if (blocos.error) throw new Error("TEST_BLOCKS_MISSING");
for (const bloco of blocos.data.filter((item) => item.narracao.trim())) {
  const hash = hashNarracao(bloco.narracao, (process.env.FISH_VOICE_ID_PRIMARY ?? process.env.FISH_VOICE_ID)!, { modelo: (process.env.START_BACK_FISH_MODEL ?? "s2.1-pro-free") as ModeloFish });
  await access(path.join(process.env.START_BACK_STORAGE_ROOT!, "projetos", roteiro.data.projeto_id, "roteiros", roteiro.data.id, "narracoes", `${hash}.mp3`));
}
const resposta = await fetch(`http://api:3000/api/v1/roteiros/${roteiro.data.id}/narracoes`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirmarCustos: true, gerarLegendas: true }) });
if (!resposta.ok) throw new Error(`TEST_NARRATION_POST:${resposta.status}`);
const job = await resposta.json() as { data: { id: string } };
for (let i = 0; i < 120; i++) {
  const resultado = await admin.from("processamentos").select("status,progresso").eq("id", job.data.id).single();
  if (resultado.error) throw new Error("TEST_JOB_GET_FAILED");
  if (resultado.data.status === "concluido") {
    const arquivos = await admin.from("arquivos").select("tipo,mime_type").eq("projeto_id", roteiro.data.projeto_id).like("chave_armazenamento", `%${job.data.id}.%`);
    if (arquivos.error || arquivos.data.length !== 4) throw new Error("TEST_RENDER_ARTIFACTS_MISSING");
    console.log(JSON.stringify({ cacheVerificado: blocos.data.length, status: "concluido", arquivos: arquivos.data }));
    await auth.auth.signOut({ scope: "local" });
    process.exit(0);
  }
  if (["erro", "cancelado", "ajuste_necessario"].includes(resultado.data.status)) throw new Error(`TEST_JOB_FAILED:${resultado.data.status}`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw new Error("TEST_JOB_TIMEOUT");
