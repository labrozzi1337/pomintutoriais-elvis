import { z } from "zod";
import { API_URL } from "@/lib/api";

const processamentoSchema = z.object({
  id: z.string().uuid(), tipo: z.string(), status: z.string(), progresso: z.number(), mensagem: z.string().nullable(), codigo_erro: z.string().nullable(),
  configuracao: z.record(z.string(), z.unknown()).default({}), criado_em: z.string()
}).passthrough();
const videoSchema = z.object({
  id: z.string().uuid(), nome_original: z.string(), status: z.string(), duracao_ms: z.number().nullable(), tamanho_bytes: z.number()
}).passthrough();
const projetoSchema = z.object({
  id: z.string().uuid(), titulo: z.string(), descricao: z.string().default(""), tags: z.array(z.string()).default([]),
  empresa: z.string().default("Sem empresa"), setor: z.string().default("Geral"), empresa_id: z.string().uuid().nullable().default(null), area_id: z.string().uuid().nullable().default(null), status: z.string(), criado_em: z.string(),
  videos: z.array(videoSchema), processamentos: z.array(processamentoSchema),
  thumbnail: z.object({ id: z.string().uuid(), mime_type: z.string(), criado_em: z.string() }).passthrough().nullable().default(null)
}).passthrough();
const listaSchema = z.object({ data: z.array(projetoSchema) });
const blocoRoteiroSchema = z.object({
  id: z.string().uuid(), ordem: z.number().int(), inicio_ms: z.number().int(), fim_ms: z.number().int(),
  duracaoDisponivelMs: z.number().int(), acao_visual: z.string(), narracao: z.string(), confianca: z.number().nullable(),
  evidencias_frame: z.array(z.number()).default([]),
  narracaoGerada: z.object({ id: z.string().uuid(), arquivo_id: z.string().uuid().nullable(), status: z.string(), duracao_ms: z.number().nullable(), taxa_aceleracao: z.number().nullable() }).nullable()
}).passthrough();
const arquivoGeradoSchema = z.object({ id: z.string().uuid(), tipo: z.string(), mime_type: z.string(), criado_em: z.string(), chave_armazenamento: z.string().optional() }).passthrough();
const roteiroSchema = z.object({ data: z.object({ id: z.string().uuid(), versao: z.number().int(), atualizado_em: z.string(), modelo: z.string().nullable(), blocos: z.array(blocoRoteiroSchema), arquivosGerados: z.array(arquivoGeradoSchema), historico: z.array(z.object({ id: z.string(), criado_em: z.string(), dados: z.unknown() })).default([]) }).passthrough() });

export type ProjetoEstudio = z.infer<typeof projetoSchema>;
export type ProcessamentoEstudio = z.infer<typeof processamentoSchema>;
export type RoteiroEstudio = z.infer<typeof roteiroSchema>["data"];
export type BlocoEstudio = RoteiroEstudio["blocos"][number];
export type OpcoesNarracao = { modoAudio: "substituir" | "ducking" | "manter_original"; vozId?: string; ajustarTextoAutomaticamente: boolean; gerarLegendas: boolean };
export type OpcoesAnalise = { modelo: "gpt-6.1-sol" | "gpt-6-astra"; tom: "natural" | "conversado"; narrarAoConcluir?: boolean };
const configuracoesSchema = z.object({ data: z.object({ vozes: z.array(z.object({ id: z.string(), nome: z.string(), padrao: z.boolean().default(false), modelo: z.string().optional() })), vozPadraoId: z.string().nullable().optional(), limiteBytes: z.number(), limiteDuracaoMs: z.number(), modeloPadrao: z.string(), retencao: z.string() }) });
export type ConfiguracoesEstudio = z.infer<typeof configuracoesSchema>["data"];
const organizacaoSchema = z.object({ data: z.array(z.object({ id: z.string().uuid(), nome: z.string(), areas: z.array(z.object({ id: z.string().uuid(), empresa_id: z.string().uuid(), nome: z.string() })) })) });
const recordesSchema = z.object({ data: z.array(z.object({ nickname: z.string(), score: z.number().int(), atualizado_em: z.string() })) });
const usuariosSchema = z.object({ data: z.object({ administrador: z.boolean(), usuarioAtualId: z.string().uuid(), usuarios: z.array(z.object({ id: z.string().uuid(), email: z.string(), nome: z.string().nullable(), tipo: z.enum(["comum", "admin"]), metodo: z.enum(["local", "microsoft"]), status: z.enum(["ativo", "bloqueado"]), confirmado: z.boolean(), criado_em: z.string(), ultimoAcessoEm: z.string().nullable() })) }) });
const passoWikiSchema = z.object({ id: z.string().uuid(), ordem: z.number().int(), titulo: z.string(), texto: z.string(), inicioMs: z.number().int().nonnegative(), fimMs: z.number().int().positive(), topico: z.string() });
const artigoWikiSchema = z.object({
  id: z.string().uuid(), projetoId: z.string().uuid(), titulo: z.string(), empresa: z.string(), area: z.string(),
  resumo: z.string(), conteudo: z.string(), arquivoVideoId: z.string().uuid().nullable(), criadoEm: z.string(), atualizadoEm: z.string(),
  passos: z.array(passoWikiSchema),
  topicos: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int(), titulo: z.string(), inicioMs: z.number().int().nonnegative(), fimMs: z.number().int().positive(), passos: z.array(passoWikiSchema) }))
});
const wikiSchema = z.object({ data: z.array(artigoWikiSchema) });
export type EmpresaEstudio = z.infer<typeof organizacaoSchema>["data"][number];
export type RecordeCobrinha = z.infer<typeof recordesSchema>["data"][number];
export type ControleUsuarios = z.infer<typeof usuariosSchema>["data"];
export type ArtigoWiki = z.infer<typeof artigoWikiSchema>;

export async function obterConfiguracoes(token: string): Promise<ConfiguracoesEstudio> {
  return (await requisicao(`${API_URL}/api/v1/configuracoes`, token, {}, configuracoesSchema)).data;
}

/** Lista os projetos que o backend autorizou para a sessão. */
export async function listarProjetos(token: string, signal?: AbortSignal): Promise<ProjetoEstudio[]> {
  return (await requisicao(`${API_URL}/api/v1/projetos`, token, { signal }, listaSchema)).data;
}

/** Cria o projeto que receberá o arquivo selecionado. */
export async function criarProjeto(token: string, titulo: string, empresaId: string, areaId: string): Promise<string> {
  const schema = z.object({ data: z.object({ id: z.string().uuid() }) });
  return (await requisicao(`${API_URL}/api/v1/projetos`, token, { method: "POST", body: JSON.stringify({ titulo, empresaId, areaId }), headers: { "Content-Type": "application/json" } }, schema)).data.id;
}

export async function listarOrganizacao(token: string): Promise<EmpresaEstudio[]> {
  return (await requisicao(`${API_URL}/api/v1/organizacao`, token, {}, organizacaoSchema)).data;
}

export async function criarEmpresa(token: string, nome: string): Promise<void> {
  await requisicao(`${API_URL}/api/v1/organizacao`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "empresa", nome }) }, z.object({ data: z.object({ id: z.string().uuid() }) }).passthrough());
}

export async function criarArea(token: string, empresaId: string, nome: string): Promise<void> {
  await requisicao(`${API_URL}/api/v1/organizacao`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "area", empresaId, nome }) }, z.object({ data: z.object({ id: z.string().uuid() }) }).passthrough());
}

export async function moverProjeto(token: string, projetoId: string, areaId: string): Promise<void> {
  await editarProjeto(token, projetoId, { areaId });
}

export async function editarProjeto(token: string, projetoId: string, entrada: { titulo?: string; descricao?: string; tags?: string[]; areaId?: string }): Promise<void> {
  await requisicao(`${API_URL}/api/v1/projetos/${projetoId}`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) }, z.object({ data: z.object({ id: z.string().uuid() }).passthrough() }));
}

export async function listarRecordes(token: string): Promise<RecordeCobrinha[]> {
  return (await requisicao(`${API_URL}/api/v1/recordes`, token, {}, recordesSchema)).data;
}

export async function registrarRecorde(token: string, nickname: string, score: number): Promise<void> {
  await requisicao(`${API_URL}/api/v1/recordes`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname, score }) }, z.object({ data: z.object({ nickname: z.string(), score: z.number() }).passthrough() }));
}

export async function listarUsuarios(token: string): Promise<ControleUsuarios> {
  return (await requisicao(`${API_URL}/api/v1/usuarios`, token, {}, usuariosSchema)).data;
}

export async function criarUsuario(token: string, entrada: { email: string; nome?: string; tipo: "comum" | "admin"; metodo: "local" | "microsoft"; senha?: string }): Promise<void> {
  await requisicao(`${API_URL}/api/v1/usuarios`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) }, z.object({ data: z.object({ id: z.string().uuid() }).passthrough() }));
}

export async function excluirUsuario(token: string, usuarioId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/usuarios/${usuarioId}`, { method: "DELETE", headers: autenticacao(token) });
  if (!response.ok) throw await erroApi(response);
}

export async function alterarTipoUsuario(token: string, usuarioId: string, tipo: "comum" | "admin"): Promise<void> {
  await requisicao(`${API_URL}/api/v1/usuarios/${usuarioId}`, token, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo }) }, z.object({ data: z.object({ id: z.string().uuid() }).passthrough() }));
}

export async function listarWiki(token: string): Promise<ArtigoWiki[]> {
  return (await requisicao(`${API_URL}/api/v1/wiki`, token, {}, wikiSchema)).data;
}

export async function salvarArtigoWiki(token: string, artigoId: string, resumo: string, conteudo: string): Promise<{ atualizado_em: string }> {
  const schema = z.object({ data: z.object({ id: z.string().uuid(), resumo: z.string(), conteudo: z.string(), atualizado_em: z.string() }) });
  return (await requisicao(`${API_URL}/api/v1/wiki/${artigoId}`, token, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumo, conteudo }) }, schema)).data;
}

/** Exclui um projeto autorizado e seus arquivos associados. */
export async function excluirProjeto(token: string, projetoId: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/projetos/${projetoId}`, { method: "DELETE", headers: autenticacao(token) });
  if (!response.ok) throw await erroApi(response);
}

/** Envia o MP4 em partes sequenciais e informa progresso real de bytes. */
export async function enviarVideo(token: string, projetoId: string, arquivo: File, onProgress: (percentual: number) => void, signal?: AbortSignal): Promise<void> {
  const inicioSchema = z.object({ data: z.object({ uploadId: z.string().uuid(), tamanhoParte: z.number().int().positive() }) });
  const inicio = await requisicao(`${API_URL}/api/v1/projetos/${projetoId}/uploads`, token, {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nomeArquivo: arquivo.name, mimeType: "video/mp4", tamanhoBytes: arquivo.size })
  }, inicioSchema);
  let enviado = 0;
  while (enviado < arquivo.size) {
    const parte = arquivo.slice(enviado, Math.min(enviado + inicio.data.tamanhoParte, arquivo.size));
    const response = await fetch(`${API_URL}/api/v1/projetos/${projetoId}/uploads/${inicio.data.uploadId}`, {
      method: "PUT", signal, headers: autenticacao(token), body: parte
    });
    if (!response.ok) throw await erroApi(response);
    enviado += parte.size;
    onProgress(Math.round((enviado / arquivo.size) * 100));
  }
  const response = await fetch(`${API_URL}/api/v1/projetos/${projetoId}/uploads/${inicio.data.uploadId}/conclusao`, { method: "POST", signal, headers: autenticacao(token) });
  if (!response.ok) throw await erroApi(response);
}

/** Solicita uma URL temporária vinculada ao vídeo e ao modo escolhido. */
export async function criarAcessoVideo(token: string, videoId: string, modo: "reproduzir" | "baixar"): Promise<string> {
  const schema = z.object({ data: z.object({ url: z.string(), expiraEm: z.string() }) });
  const resultado = await requisicao(`${API_URL}/api/v1/videos/${videoId}/acessos`, token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modo })
  }, schema);
  return `${API_URL}${resultado.data.url}`;
}

/** Agenda a análise visual no worker sem bloquear a interface. */
export async function solicitarAnalise(token: string, videoId: string, confirmarSubstituicao = false, opcoes?: OpcoesAnalise): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/videos/${videoId}/analises`, {
    method: "POST", headers: { ...autenticacao(token), "Content-Type": "application/json" },
    body: JSON.stringify({ confirmarSubstituicao, confirmarCustos: true, ...opcoes })
  });
  if (!response.ok) throw await erroApi(response);
}

/** Busca a versão atual do roteiro com cenas cronológicas. */
export async function obterRoteiro(token: string, projetoId: string): Promise<RoteiroEstudio> {
  return (await requisicao(`${API_URL}/api/v1/projetos/${projetoId}/roteiro`, token, {}, roteiroSchema)).data;
}

/** Confirma custos e agenda geração completa ou de um único bloco. */
export async function solicitarNarracao(token: string, roteiroId: string, blocoId?: string, regenerarTudo = false, opcoes?: OpcoesNarracao): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/roteiros/${roteiroId}/narracoes`, {
    method: "POST", headers: { ...autenticacao(token), "Content-Type": "application/json" },
    body: JSON.stringify({ modoAudio: "substituir", confirmarCustos: true, blocoId, regenerarTudo, ...opcoes })
  });
  if (!response.ok) throw await erroApi(response);
}

export async function salvarBlocos(token: string, roteiro: RoteiroEstudio, blocos: BlocoEstudio[]): Promise<RoteiroEstudio> {
  return (await requisicao(`${API_URL}/api/v1/roteiros/${roteiro.id}/blocos`, token, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ atualizadoEm: roteiro.atualizado_em, blocos: blocos.map((bloco) => ({ id: bloco.id || undefined, inicioMs: bloco.inicio_ms, fimMs: bloco.fim_ms, acaoVisual: bloco.acao_visual, narracao: bloco.narracao, evidenciasFrame: bloco.evidencias_frame.filter((ms) => ms >= bloco.inicio_ms && ms <= bloco.fim_ms), confianca: bloco.confianca ?? 0 })) })
  }, roteiroSchema)).data;
}

export async function cancelarProcessamento(token: string, id: string): Promise<void> {
  const resposta = await fetch(`${API_URL}/api/v1/processamentos/${id}`, { method: "DELETE", headers: autenticacao(token) });
  if (!resposta.ok) throw await erroApi(resposta);
}

/** Emite acesso curto para ouvir ou baixar um artefato gerado. */
export async function criarAcessoArquivo(token: string, arquivoId: string, modo: "baixar" | "reproduzir" = "baixar"): Promise<string> {
  const schema = z.object({ data: z.object({ url: z.string(), expiraEm: z.string() }) });
  const resultado = await requisicao(`${API_URL}/api/v1/arquivos/${arquivoId}/acessos`, token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modo }) }, schema);
  return `${API_URL}${resultado.data.url}`;
}

export async function salvarThumbnail(token: string, projetoId: string, imagem: Blob): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/projetos/${projetoId}/thumbnail`, { method: "PUT", credentials: "include", headers: { ...autenticacao(token), "Content-Type": "image/jpeg" }, body: imagem });
  if (!response.ok) throw await erroApi(response);
}

/** Executa uma requisição autenticada e valida o contrato antes de usá-lo na UI. */
async function requisicao<T>(url: string, token: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { ...Object.fromEntries(new Headers(init.headers)), ...autenticacao(token) } });
  if (!response.ok) throw await erroApi(response);
  const parsed = schema.safeParse(await lerJsonApi(response));
  if (!parsed.success) throw new Error("A API retornou um formato inválido.");
  return parsed.data;
}

/** Monta o único header de identidade aceito pelos endpoints protegidos. */
function autenticacao(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Converte o envelope de erro do backend em mensagem acionável sem expor detalhes. */
async function erroApi(response: Response): Promise<Error> {
  const body = await lerJsonApi(response).catch(() => null) as { error?: { message?: string } } | null;
  return new Error(body?.error?.message ?? "Não foi possível concluir a operação.");
}

async function lerJsonApi(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("A API respondeu em formato inesperado. Acesse o Estúdio pelo endereço correto e atualize a página.");
  return response.json();
}
