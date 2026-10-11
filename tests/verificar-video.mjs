import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import path from "node:path";
const cliente = createClient(process.env.START_BACK_SUPABASE_URL, process.env.START_BACK_SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "tutoriais" }, auth: { persistSession: false } });
const arquivo = await cliente.from("arquivos").select("chave_armazenamento").eq("tipo", "video_final").order("criado_em", { ascending: false }).limit(1).single();
if (arquivo.error) throw new Error("FILE_NOT_FOUND");
const resultado = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,profile,pix_fmt", "-of", "json", path.join(process.env.START_BACK_STORAGE_ROOT, arquivo.data.chave_armazenamento)], { encoding: "utf8" });
if (resultado.status !== 0) throw new Error("PROBE_FAILED");
console.log(resultado.stdout);
