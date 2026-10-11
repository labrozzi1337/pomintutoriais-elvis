import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Building2, ChevronRight, Clock3, FileText, ListVideo, Pencil, Play, PlayCircle, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { criarAcessoArquivo, listarWiki, salvarArtigoWiki, type ArtigoWiki } from "@/lib/estudio-api";

const campo = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const formatarTempo = (tempoMs: number) => `${Math.floor(tempoMs / 60_000)}:${Math.floor(tempoMs % 60_000 / 1_000).toString().padStart(2, "0")}`;

export function WikiPage() {
  const player = useRef<HTMLVideoElement>(null);
  const [params] = useSearchParams();
  const projetoSolicitado = params.get("projeto");
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [artigos, setArtigos] = useState<ArtigoWiki[]>([]);
  const [selecionadoId, setSelecionadoId] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(false);
  const [resumo, setResumo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tempoAtualMs, setTempoAtualMs] = useState(0);

  useEffect(() => {
    let ativo = true;
    void listarWiki(token).then((lista) => {
      if (!ativo) return;
      setArtigos(lista);
      const primeiro = lista.find((item) => item.projetoId === projetoSolicitado) ?? lista[0];
      if (primeiro) {
        setSelecionadoId(primeiro.id);
        setResumo(primeiro.resumo);
        setConteudo(primeiro.conteudo);
      }
    }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível abrir a Wiki."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [token, projetoSolicitado]);

  const artigo = artigos.find((item) => item.id === selecionadoId) ?? null;
  const arquivoVideoId = artigo?.arquivoVideoId;
  const urlVideo = arquivoVideoId ? videos[arquivoVideoId] : undefined;
  const topicoAtivo = artigo?.topicos.find((topico) => tempoAtualMs >= topico.inicioMs && tempoAtualMs < topico.fimMs)?.id;

  useEffect(() => {
    if (!arquivoVideoId || videos[arquivoVideoId]) return;
    let ativo = true;
    void criarAcessoArquivo(token, arquivoVideoId, "reproduzir")
      .then((url) => { if (ativo) setVideos((atuais) => ({ ...atuais, [arquivoVideoId]: url })); })
      .catch(() => { if (ativo) setErro("O artigo foi aberto, mas o vídeo não pôde ser carregado."); });
    return () => { ativo = false; };
  }, [arquivoVideoId, token, videos]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = artigos.filter((item) => !termo || `${item.titulo} ${item.empresa} ${item.area} ${item.resumo} ${item.topicos.map((topico) => topico.titulo).join(" ")}`.toLocaleLowerCase("pt-BR").includes(termo));
  const empresas = [...new Set(visiveis.map((item) => item.empresa))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  function selecionar(item: ArtigoWiki) {
    setSelecionadoId(item.id);
    setResumo(item.resumo);
    setConteudo(item.conteudo);
    setEditando(false);
    setErro("");
    setTempoAtualMs(0);
  }

  function assistirEm(inicioMs: number) {
    if (!player.current) return;
    player.current.currentTime = inicioMs / 1_000;
    setTempoAtualMs(inicioMs);
    void player.current.play().catch(() => setErro("O vídeo está no ponto certo. Use o botão de reprodução para continuar."));
    player.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelarEdicao() {
    if (artigo) { setResumo(artigo.resumo); setConteudo(artigo.conteudo); }
    setEditando(false);
  }

  async function salvar() {
    if (!artigo) return;
    setSalvando(true); setErro("");
    try {
      const salvo = await salvarArtigoWiki(token, artigo.id, resumo, conteudo);
      setArtigos((atuais) => atuais.map((item) => item.id === artigo.id ? { ...item, resumo: resumo.trim(), conteudo: conteudo.trim(), atualizadoEm: salvo.atualizado_em } : item));
      setResumo(resumo.trim()); setConteudo(conteudo.trim()); setEditando(false);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o artigo.");
    } finally { setSalvando(false); }
  }

  return <div className="mx-auto min-h-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
    <header className="mb-6"><p className="eyebrow">Base de conhecimento</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Wiki de tutoriais</h1><p className="mt-2 text-sm text-muted-foreground">Consulte o vídeo, entenda o objetivo e siga o passo a passo da operação.</p></header>
    {erro && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}

    {carregando ? <div className="hub-card rounded-2xl p-8 text-sm text-muted-foreground">Carregando a base de conhecimento…</div> : !artigos.length ? <section className="hub-card grid min-h-80 place-items-center rounded-2xl p-8 text-center"><div><BookOpen className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 text-lg font-semibold">A Wiki será preenchida automaticamente</h2><p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Conclua a geração de um tutorial e mantenha-o alocado em uma empresa e área. Ele aparecerá aqui com o vídeo e o passo a passo do roteiro.</p></div></section> :
      <div className="grid min-h-[680px] overflow-hidden rounded-2xl border bg-background lg:grid-cols-[310px_1fr]">
        <aside className="border-b bg-muted/20 p-4 lg:border-b-0 lg:border-r">
          <label className="relative block"><span className="sr-only">Buscar na Wiki</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className={`${campo} pl-9`} value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar tutorial…" /></label>
          <nav className="mt-5 space-y-5" aria-label="Artigos da Wiki">
            {empresas.map((empresa) => <section key={empresa}><h2 className="flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{empresa}</h2>
              {[...new Set(visiveis.filter((item) => item.empresa === empresa).map((item) => item.area))].sort((a, b) => a.localeCompare(b, "pt-BR")).map((area) => <div key={area} className="mt-2"><p className="px-2 text-xs font-medium text-muted-foreground">{area}</p><div className="mt-1 space-y-1">{visiveis.filter((item) => item.empresa === empresa && item.area === area).map((item) => <button key={item.id} type="button" onClick={() => selecionar(item)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${selecionadoId === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.titulo}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" /></button>)}</div></div>)}
            </section>)}
            {!visiveis.length && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Nenhum artigo corresponde à busca.</p>}
          </nav>
        </aside>

        {artigo && <article className="min-w-0 p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6"><div><p className="text-xs font-medium text-primary">{artigo.empresa} <span className="text-muted-foreground">/</span> {artigo.area}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{artigo.titulo}</h2><p className="mt-2 text-xs text-muted-foreground">Atualizado em {new Date(artigo.atualizadoEm).toLocaleDateString("pt-BR")}</p></div>{editando ? <div className="flex gap-2"><Button variant="ghost" onClick={cancelarEdicao}><X className="h-4 w-4" />Cancelar</Button><Button disabled={salvando} onClick={() => void salvar()}><Save className="h-4 w-4" />{salvando ? "Salvando…" : "Salvar"}</Button></div> : <Button variant="outline" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" />Editar explicações</Button>}</div>

          {editando ? <section className="mt-8 space-y-5"><div><label htmlFor="wiki-resumo" className="text-sm font-semibold">Resumo de aprendizagem</label><p className="mb-2 mt-1 text-xs text-muted-foreground">Explique o resultado que a pessoa conseguirá alcançar.</p><textarea id="wiki-resumo" maxLength={2000} rows={3} className={campo} value={resumo} onChange={(event) => setResumo(event.target.value)} /></div><div><label htmlFor="wiki-conteudo" className="text-sm font-semibold">Explicações complementares</label><p className="mb-2 mt-1 text-xs text-muted-foreground">Inclua regras, conceitos, pré-requisitos e observações que ajudam a executar o tutorial.</p><textarea id="wiki-conteudo" maxLength={30000} rows={12} className={campo} value={conteudo} onChange={(event) => setConteudo(event.target.value)} /></div><p className="text-xs text-muted-foreground">Próximo passo: revise o texto e clique em Salvar. O vídeo e o passo a passo continuam sincronizados com o tutorial.</p></section> : <>
            <section className="mt-8"><h3 className="text-lg font-semibold">O que você vai aprender</h3><p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{artigo.resumo || `Neste tutorial, você aprenderá a executar “${artigo.titulo}” do início ao fim.`}</p></section>

            {arquivoVideoId && <section className="mt-8"><h3 className="flex items-center gap-2 text-lg font-semibold"><PlayCircle className="h-5 w-5 text-primary" />Tutorial em vídeo</h3><p className="mt-1 text-sm text-muted-foreground">Assista do início ou escolha um tópico para ir direto ao trecho certo.</p><div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">{urlVideo ? <video ref={player} className="aspect-video w-full rounded-xl bg-black" controls preload="metadata" src={urlVideo} onTimeUpdate={(event) => setTempoAtualMs(event.currentTarget.currentTime * 1_000)} /> : <div className="aspect-video w-full animate-pulse rounded-xl bg-muted" />}
              <aside className="overflow-hidden rounded-xl border bg-muted/20"><div className="border-b p-4"><h4 className="flex items-center gap-2 font-semibold"><ListVideo className="h-4 w-4 text-primary" />Tópicos do vídeo</h4><p className="mt-1 text-xs text-muted-foreground">Clique para assistir somente a parte que você precisa.</p></div><div className="max-h-[420px] space-y-1 overflow-y-auto p-2">{artigo.topicos.map((topico, indice) => <button key={topico.id} type="button" disabled={!urlVideo} aria-pressed={topicoAtivo === topico.id} onClick={() => assistirEm(topico.inicioMs)} className={`flex w-full gap-3 rounded-lg p-3 text-left transition-colors disabled:cursor-wait disabled:opacity-50 ${topicoAtivo === topico.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${topicoAtivo === topico.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>{indice + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{topico.titulo}</span><span className={`mt-1 flex items-center gap-1 text-xs ${topicoAtivo === topico.id ? "text-primary-foreground/75" : "text-muted-foreground"}`}><Clock3 className="h-3 w-3" />{formatarTempo(topico.inicioMs)}–{formatarTempo(topico.fimMs)} · {topico.passos.length} {topico.passos.length === 1 ? "etapa" : "etapas"}</span></span></button>)}{!artigo.topicos.length && <p className="p-3 text-sm text-muted-foreground">Os tópicos ainda estão sendo preparados.</p>}</div></aside>
            </div></section>}

            {artigo.conteudo && <section className="mt-10 max-w-4xl"><h3 className="text-lg font-semibold">Antes de começar</h3><div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">{artigo.conteudo.split(/\n{2,}/).map((paragrafo, indice) => <p key={`${artigo.id}-${indice}`} className="whitespace-pre-line">{paragrafo}</p>)}</div></section>}

            <section className="mt-10 max-w-4xl"><h3 className="text-lg font-semibold">Guia por tópicos</h3><p className="mt-1 text-sm text-muted-foreground">Abra um assunto para entender as ações. O botão leva o vídeo direto ao começo daquele trecho.</p><ol className="mt-5 space-y-5">{artigo.topicos.map((topico, indice) => <li key={topico.id} className="overflow-hidden rounded-xl border"><div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{indice + 1}</span><div><h4 className="font-semibold">{topico.titulo}</h4><p className="mt-0.5 text-xs text-muted-foreground">{formatarTempo(topico.inicioMs)}–{formatarTempo(topico.fimMs)}</p></div></div><Button variant="outline" disabled={!urlVideo} onClick={() => assistirEm(topico.inicioMs)}><Play className="h-4 w-4" />Assistir este tópico</Button></div><ol className="divide-y">{topico.passos.map((passo, passoIndice) => <li key={passo.id} className="grid gap-3 p-4 sm:grid-cols-[64px_1fr]"><button type="button" disabled={!urlVideo} onClick={() => assistirEm(passo.inicioMs)} className="h-fit rounded-md bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-wait disabled:opacity-50" aria-label={`Assistir etapa ${passoIndice + 1} em ${formatarTempo(passo.inicioMs)}`}>{formatarTempo(passo.inicioMs)}</button><div><h5 className="text-sm font-semibold">{passo.titulo || `Etapa ${passoIndice + 1}`}</h5><p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{passo.texto}</p></div></li>)}</ol></li>)}</ol>{!artigo.topicos.length && <p className="mt-4 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">O vídeo está publicado, mas ainda não há tópicos disponíveis no roteiro.</p>}</section>
          </>}
        </article>}
      </div>}
  </div>;
}
