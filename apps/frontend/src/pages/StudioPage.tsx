import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BibliotecaTutoriais } from "@/components/estudio/BibliotecaTutoriais";
import { EditorTutorial } from "@/components/estudio/EditorTutorial";
import { EtapasTutorial } from "@/components/estudio/EtapasTutorial";
import { IntegracaoWindows } from "@/components/estudio/IntegracaoWindows";
import { ProcessamentoCriativo } from "@/components/estudio/ProcessamentoCriativo";
import { useAuth } from "@/contexts/auth";
import { cancelarProcessamento, criarAcessoVideo, criarProjeto, enviarVideo, excluirProjeto, listarOrganizacao, listarProjetos, obterConfiguracoes, obterRoteiro, type ConfiguracoesEstudio, type EmpresaEstudio, type ProjetoEstudio, type RoteiroEstudio } from "@/lib/estudio-api";
import { percentualDoFluxo } from "@/lib/progresso-processamento";

const terminal = new Set(["concluido", "erro", "cancelado", "roteiro_pronto", "ajuste_necessario"]);
const campo = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StudioPage({ modo = "biblioteca" }: { modo?: "biblioteca" | "criar" }) {
  const { session, sair, tipo } = useAuth();
  const token = session?.access_token ?? "";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const projetoId = params.get("projeto");
  const [projetos, setProjetos] = useState<ProjetoEstudio[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaEstudio[]>([]);
  const [config, setConfig] = useState<ConfiguracoesEstudio | null>(null);
  const [roteiro, setRoteiro] = useState<RoteiroEstudio | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState(false);
  const [etapaNovo, setEtapaNovo] = useState<"origem" | "gravar" | "gravando" | "upload">("origem");
  const upload = useRef<AbortController | null>(null);
  const selecao = projetos.find((projeto) => projeto.id === projetoId);
  const job = selecao?.processamentos.find((item) => !terminal.has(item.status)) ?? selecao?.processamentos[0];
  const ocupado = Boolean(job && !terminal.has(job.status));
  const percentualFluxo = job ? percentualDoFluxo(job) : 0;
  const areas = empresas.find((empresa) => empresa.id === empresaId)?.areas ?? [];

  const recarregar = useCallback(async () => { setProjetos(await listarProjetos(token)); }, [token]);
  const atualizarEditor = useCallback(async () => {
    await recarregar();
    if (!projetoId) return;
    try { setRoteiro(await obterRoteiro(token, projetoId)); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "Roteiro não encontrado.") throw error;
      setRoteiro(null);
    }
  }, [token, projetoId, recarregar]);

  useEffect(() => {
    let ativo = true;
    void Promise.all([listarProjetos(token), obterConfiguracoes(token), listarOrganizacao(token)])
      .then(([lista, configuracoes, organizacao]) => { if (ativo) { setProjetos(lista); setConfig(configuracoes); setEmpresas(organizacao); } })
      .catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Falha ao carregar."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; upload.current?.abort(); };
  }, [token]);

  useEffect(() => {
    if (modo !== "criar" || !projetoId) return;
    let ativo = true;
    void Promise.resolve().then(() => { if (ativo) { setAbrindo(true); setRoteiro(null); } });
    void obterRoteiro(token, projetoId).then((dados) => { if (ativo) setRoteiro(dados); }).catch((error: unknown) => {
      if (ativo && error instanceof Error && error.message !== "Roteiro não encontrado.") setErro(error.message);
    }).finally(() => { if (ativo) setAbrindo(false); });
    return () => { ativo = false; };
  }, [token, projetoId, job?.status, modo]);

  useEffect(() => {
    if (!projetos.some((projeto) => projeto.processamentos.some((item) => !terminal.has(item.status)))) return;
    const timer = window.setInterval(() => { if (!document.hidden) void recarregar().catch((error: unknown) => setErro(error instanceof Error ? error.message : "Sem conexão. Tente atualizar.")); }, 3000);
    return () => window.clearInterval(timer);
  }, [projetos, recarregar]);

  async function executar(fn: () => Promise<void>) {
    setErro("");
    try { await fn(); } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível concluir."); }
  }

  async function importar(event?: FormEvent<HTMLFormElement>, novoArquivo = arquivo, novaEmpresaId = empresaId, novaAreaId = areaId, tituloInformado = titulo) {
    event?.preventDefault();
    if (!novoArquivo || !novoArquivo.name.toLowerCase().endsWith(".mp4")) throw new Error("Selecione um MP4 exportado.");
    if (!novaEmpresaId || !novaAreaId) throw new Error("Selecione a empresa e a área.");
    if (!tituloInformado.trim()) throw new Error("Informe o título do tutorial.");
    if (config && novoArquivo.size > config.limiteBytes) throw new Error(`Limite: ${Math.round(config.limiteBytes / 1024 / 1024)} MB.`);
    upload.current = new AbortController(); setProgresso(0);
    try {
      const id = await criarProjeto(token, tituloInformado.trim(), novaEmpresaId, novaAreaId);
      await enviarVideo(token, id, novoArquivo, setProgresso, upload.current.signal);
      setEmpresaId(""); setAreaId(""); setTitulo(""); setArquivo(null); await recarregar(); setParams({ projeto: id });
    } finally { setProgresso(null); }
  }

  async function duplicar(projeto: ProjetoEstudio) {
    const video = projeto.videos[0];
    const empresa = empresas.find((item) => item.nome === projeto.empresa);
    const area = empresa?.areas.find((item) => item.nome === projeto.setor);
    if (!video || !empresa || !area || !window.confirm("Duplicar o MP4 em um novo projeto? A cópia ocupa armazenamento adicional.")) return;
    const resposta = await fetch(await criarAcessoVideo(token, video.id, "baixar"), { credentials: "include" });
    if (!resposta.ok) throw new Error("Não foi possível baixar o original para duplicar.");
    await importar(undefined, new File([await resposta.blob()], video.nome_original, { type: "video/mp4" }), empresa.id, area.id, `${projeto.titulo.slice(0, 150)} (cópia)`);
  }

  if (modo === "biblioteca") return <div className="mx-auto min-h-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Biblioteca</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Todos os seus vídeos</h1><p className="mt-2 text-sm text-muted-foreground">Encontre originais e tutoriais finalizados. Para produzir um novo, use a área de criação.</p></div><div className="flex gap-2"><Button onClick={() => { void navigate("/criar"); }}>Criar novo vídeo</Button><Button variant="outline" onClick={() => { void executar(sair); }}><LogOut className="h-4 w-4" />Sair</Button></div></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    <BibliotecaTutoriais projetos={projetos} empresas={empresas} carregando={carregando} token={token} projetoId={null} progresso={progresso} podeExcluir={tipo === "admin"} aoEditar={(id) => { void navigate(`/criar?projeto=${id}`); }} aoVerTutorial={(id) => { void navigate(`/wiki?projeto=${id}`); }} aoDuplicar={(projeto) => { void executar(() => duplicar(projeto)); }} aoExcluir={(projeto) => { if (window.confirm("Excluir permanentemente este tutorial e todos os arquivos vinculados?")) void executar(async () => { await excluirProjeto(token, projeto.id); await recarregar(); }); }} aoAtualizar={recarregar} />
  </div>;

  return <div className="mx-auto min-h-full max-w-[1280px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Criação guiada</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{selecao ? selecao.titulo : "Criar um novo tutorial"}</h1><p className="mt-2 text-sm text-muted-foreground">{selecao ? "Conclua a etapa indicada abaixo. Nenhum outro vídeo interfere neste trabalho." : "Siga uma etapa por vez; a próxima ação fica sempre destacada."}</p></div><Link to="/tutoriais" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"><ArrowLeft className="h-4 w-4" />Voltar à biblioteca</Link></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    {!projetoId && <section className="hub-card space-y-5 rounded-2xl p-5 sm:p-6"><div><p className="eyebrow">Passo 1</p><h2 className="mt-1 text-xl font-semibold">Informe de onde vem o vídeo</h2><p className="mt-1 text-sm text-muted-foreground">Escolha uma opção para revelar somente o próximo passo.</p></div><EtapasTutorial atual={1} />
      {etapaNovo === "origem" && <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setEtapaNovo("upload")} className="rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><strong>Já tenho o vídeo</strong><span className="mt-1 block text-sm text-muted-foreground">Selecionar um MP4 pronto para envio.</span></button><button type="button" onClick={() => setEtapaNovo("gravar")} className="rounded-xl border p-5 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><strong>Ainda vou gravar</strong><span className="mt-1 block text-sm text-muted-foreground">Abrir o gravador e voltar após exportar.</span></button></div>}
      {etapaNovo === "gravar" && <div><Button variant="ghost" onClick={() => setEtapaNovo("origem")}>← Voltar</Button><div className="mt-2"><IntegracaoWindows aoAbrir={() => setEtapaNovo("gravando")} /></div></div>}
      {etapaNovo === "gravando" && <div className="rounded-xl border border-primary/30 bg-primary/5 p-5" role="status"><div className="flex items-start gap-3"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h3 className="font-semibold">Gravador aberto — agora grave seu vídeo</h3><ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground"><li>Grave e edite a tela.</li><li>Exporte em MP4.</li><li>Volte e avance abaixo.</li></ol><Button className="mt-4" onClick={() => setEtapaNovo("upload")}>Já exportei o MP4</Button></div></div></div>}
      {etapaNovo === "upload" && (empresas.length ? <div><div className="mb-4"><h3 className="font-semibold">Organize e envie</h3><p className="mt-1 text-sm text-muted-foreground">Selecione a organização, escolha o MP4 e ajuste o título se necessário.</p></div><form onSubmit={(event) => { void executar(() => importar(event)); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const selecionado = event.dataTransfer.files[0] ?? null; setArquivo(selecionado); if (selecionado && !titulo) setTitulo(selecionado.name.replace(/\.mp4$/i, "")); }} className="grid gap-4 rounded-xl border border-dashed p-5 lg:grid-cols-[1fr_1fr_1fr_1.5fr_auto] lg:items-end"><label className="text-xs font-medium">Empresa<select required className={`${campo} mt-2`} value={empresaId} onChange={(event) => { setEmpresaId(event.target.value); setAreaId(""); }}><option value="">Selecione</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select></label><label className="text-xs font-medium">Área<select required disabled={!empresaId} className={`${campo} mt-2`} value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Selecione</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}</select></label><label className="text-xs font-medium">Título<input required maxLength={160} className={`${campo} mt-2`} value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Nome do tutorial" /></label><label className="text-xs font-medium">Vídeo MP4<input type="file" accept="video/mp4,.mp4" onChange={(event) => { const selecionado = event.target.files?.[0] ?? null; setArquivo(selecionado); if (selecionado && !titulo) setTitulo(selecionado.name.replace(/\.mp4$/i, "")); }} className="mt-2 block w-full text-xs" />{arquivo && <span className="mt-1 block text-muted-foreground">{arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(1)} MB</span>}</label><Button type="submit" disabled={!arquivo || !empresaId || !areaId || !titulo.trim() || progresso !== null}>Enviar e continuar</Button></form><p className="mt-3 text-xs text-muted-foreground">Próximo passo: após o envio, esta tela abrirá a preparação do tutorial automaticamente.</p></div> : <div className="rounded-xl border border-dashed p-6 text-center"><h3 className="font-semibold">Cadastre uma empresa e uma área primeiro</h3><p className="mt-2 text-sm text-muted-foreground">Isso evita nomes duplicados ou escritos de formas diferentes.</p><Link to="/organizacao" className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Ir para organização</Link></div>)}
    </section>}
    {progresso !== null && <div className="hub-card rounded-xl p-4" role="status"><div className="flex justify-between text-sm"><span>{progresso < 100 ? `Enviando arquivo · ${progresso}%` : "Upload concluído · preparando o vídeo…"}</span>{progresso < 100 && <Button variant="ghost" onClick={() => upload.current?.abort()}>Cancelar upload</Button>}</div><progress className="mt-2 h-2 w-full accent-primary" max={100} value={progresso} aria-label="Progresso do upload" /></div>}
    {projetoId && !selecao && carregando && <p className="text-sm text-muted-foreground">Abrindo projeto…</p>}
    {selecao && (ocupado && job ? <ProcessamentoCriativo key={job.id} token={token} nickname={session?.user.email?.split("@")[0]?.slice(0, 10) ?? "JOGADOR"} processamento={job} percentual={percentualFluxo} aoCancelar={() => { void executar(async () => { await cancelarProcessamento(token, job.id); await recarregar(); }); }} /> : <>{job && ["erro", "cancelado", "ajuste_necessario"].includes(job.status) && <div className="hub-card rounded-xl p-4" role="status"><p className="text-sm font-medium">{job.status.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{job.mensagem}</p></div>}{abrindo ? <p className="text-sm text-muted-foreground">Abrindo roteiro…</p> : <EditorTutorial key={`${selecao.id}-${roteiro?.atualizado_em ?? "sem-roteiro"}`} token={token} projeto={selecao} roteiro={roteiro} configuracoes={config} ocupado={ocupado} aoAtualizar={atualizarEditor} />}</>)}
  </div>;
}
