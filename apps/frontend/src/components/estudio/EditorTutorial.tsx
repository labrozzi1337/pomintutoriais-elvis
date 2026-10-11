import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Download, Mic2, Play, Save, Scissors, Undo2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EtapasTutorial } from "@/components/estudio/EtapasTutorial";
import { criarAcessoArquivo, criarAcessoVideo, salvarBlocos, solicitarAnalise, solicitarNarracao, type BlocoEstudio, type ConfiguracoesEstudio, type OpcoesNarracao, type ProjetoEstudio, type RoteiroEstudio } from "@/lib/estudio-api";
import { dividirBloco, unirBlocos } from "@/lib/timeline-editor";

const campo = "mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const segundos = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
const snapshotSchema = z.object({ antes: z.array(z.object({ id: z.string(), inicioMs: z.number(), fimMs: z.number(), acaoVisual: z.string(), narracao: z.string(), evidenciasFrame: z.array(z.number()), confianca: z.number() })) });

export function EditorTutorial({ token, projeto, roteiro, configuracoes, aoAtualizar, ocupado }: {
  token: string; projeto: ProjetoEstudio; roteiro: RoteiroEstudio | null; configuracoes: ConfiguracoesEstudio | null; aoAtualizar: () => Promise<void>; ocupado: boolean;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const limiteTrecho = useRef<number | null>(null);
  const carregamentoAutomatico = useRef(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState("");
  const [blocos, setBlocos] = useState(roteiro?.blocos ?? []);
  const [selecionado, setSelecionado] = useState(0);
  const [alterado, setAlterado] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState("");
  const [modelo, setModelo] = useState<"gpt-6.1-sol" | "gpt-6-astra">("gpt-6.1-sol");
  const [tom, setTom] = useState<"natural" | "conversado">("conversado");
  const [automatico, setAutomatico] = useState(true);
  const [consentimento, setConsentimento] = useState(false);
  const [exibindo, setExibindo] = useState<"original" | "final" | null>(null);
  const ultimoJob = projeto.processamentos.find((job) => job.tipo === "gerar_narracao");
  const configAnterior = ultimoJob?.configuracao as Partial<OpcoesNarracao> | undefined;
  const [opcoes, setOpcoes] = useState<OpcoesNarracao>({ modoAudio: configAnterior?.modoAudio ?? "substituir", vozId: configAnterior?.vozId ?? configuracoes?.vozPadraoId ?? configuracoes?.vozes.find((voz) => voz.padrao)?.id ?? configuracoes?.vozes[0]?.id, ajustarTextoAutomaticamente: configAnterior?.ajustarTextoAutomaticamente ?? true, gerarLegendas: configAnterior?.gerarLegendas ?? true });
  const video = projeto.videos[0];
  const cena = blocos[selecionado];
  const bloqueado = pendente || ocupado;
  const finais = roteiro?.arquivosGerados.filter((item) => item.tipo === "video_final") ?? [];
  const videoFinal = finais[0];
  const videoFinalId = videoFinal?.id;
  const videoId = video?.id;
  const videoPronto = video?.status === "pronto";
  const arquivosRender = roteiro?.arquivosGerados.filter((item) => item.tipo === "video_final" || item.mime_type === "audio/wav" || item.tipo === "legenda") ?? [];

  useEffect(() => {
    const alvo = videoFinalId ? "final" : videoPronto && videoId ? "original" : null;
    if (!alvo) return;
    let ativo = true;
    const acesso = alvo === "final" ? criarAcessoArquivo(token, videoFinalId!, "reproduzir") : criarAcessoVideo(token, videoId!, "reproduzir");
    void acesso.then((src) => { if (ativo && carregamentoAutomatico.current) { setUrl(src); setExibindo(alvo); } })
      .catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível abrir o vídeo."); })
    return () => { ativo = false; };
  }, [token, videoId, videoPronto, videoFinalId]);

  async function executar(fn: () => Promise<void>) {
    setPendente(true); setErro("");
    try { await fn(); } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setPendente(false); }
  }

  async function trecho(indice: number) {
    const bloco = blocos[indice];
    if (!bloco || !video) return;
    carregamentoAutomatico.current = false;
    setSelecionado(indice);
    const src = await criarAcessoVideo(token, video.id, "reproduzir");
    setUrl(src);
    setExibindo("original");
    limiteTrecho.current = bloco.fim_ms / 1000;
    if (player.current) {
      player.current.src = src;
      player.current.onloadedmetadata = () => {
        if (!player.current) return;
        player.current.currentTime = bloco.inicio_ms / 1000;
        void player.current.play().catch(() => setErro("Clique em reproduzir no player para ouvir o trecho."));
      };
    }
  }

  function editar(valores: Partial<BlocoEstudio>) {
    setBlocos((atuais) => atuais.map((bloco, indice) => indice === selecionado ? { ...bloco, ...valores, narracaoGerada: null } : bloco));
    setAlterado(true);
  }

  async function salvar() {
    if (!roteiro) return;
    const salvo = await salvarBlocos(token, roteiro, blocos);
    setBlocos(salvo.blocos); setAlterado(false);
    await aoAtualizar();
  }

  async function narrar(blocoId?: string, regenerarTudo = false) {
    if (!roteiro || !consentimento) return;
    if (!window.confirm("A geração consome créditos de voz e processamento. Continuar?")) return;
    audio.current?.pause();
    await solicitarNarracao(token, roteiro.id, blocoId, regenerarTudo, opcoes);
    await aoAtualizar();
  }

  async function abrir(arquivoId: string, modo: "baixar" | "ouvir" | "video" = "baixar") {
    const src = await criarAcessoArquivo(token, arquivoId, modo === "baixar" ? "baixar" : "reproduzir");
    if (modo === "video") { carregamentoAutomatico.current = false; limiteTrecho.current = null; setUrl(src); setExibindo("final"); }
    else if (modo === "ouvir") { audio.current?.pause(); audio.current = new Audio(src); await audio.current.play(); }
    else { const link = document.createElement("a"); link.href = src; link.click(); }
  }

  return <section className="hub-card rounded-2xl p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{projeto.titulo}</h2><p className="mt-1 text-xs text-muted-foreground">{video?.duracao_ms ? segundos(video.duracao_ms) : "Aguardando validação"} · {roteiro ? `Roteiro v${roteiro.versao}` : "Sem roteiro"}</p></div><Button variant="outline" disabled={pendente} onClick={() => { void executar(aoAtualizar); }}>Atualizar projeto</Button></div>
    <div className="mt-5"><EtapasTutorial atual={roteiro ? 3 : 2} /><p className="mt-3 text-sm text-muted-foreground">{roteiro ? "Pronto para revisar, ajustar ou baixar." : "Escolha abaixo se quer somente o roteiro ou o tutorial narrado completo."}</p></div>
    {erro && <p role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
      <div className="min-w-0"><video ref={player} controls src={url || undefined} onTimeUpdate={() => { if (player.current && limiteTrecho.current !== null && player.current.currentTime >= limiteTrecho.current) { player.current.pause(); limiteTrecho.current = null; } }} className="aspect-video w-full rounded-xl bg-black" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {videoFinal ? <Button aria-pressed={exibindo === "final"} variant={exibindo === "final" ? "default" : "outline"} className={`h-auto min-h-14 justify-start px-4 text-left ${exibindo === "final" ? "disabled:opacity-100" : "opacity-60 hover:opacity-100"}`} disabled={exibindo === "final" || pendente} onClick={() => { void executar(() => abrir(videoFinal.id, "video")); }}><Play className="h-4 w-4 shrink-0" /><span><strong className="block">Vídeo editado</strong><small className="block font-normal opacity-80">{exibindo === "final" ? "Em exibição · versão padrão" : "Alterar para esta versão"}</small></span></Button> : <div className="grid min-h-14 place-items-center rounded-md border border-dashed px-3 text-center text-xs text-muted-foreground">Vídeo editado ainda não gerado</div>}
          <Button aria-pressed={exibindo === "original"} variant={exibindo === "original" ? "default" : "outline"} className={`h-auto min-h-14 justify-start px-4 text-left ${exibindo === "original" ? "disabled:opacity-100" : "opacity-60 hover:opacity-100"}`} disabled={!video || video.status !== "pronto" || exibindo === "original" || pendente} onClick={() => { carregamentoAutomatico.current = false; void executar(async () => { limiteTrecho.current = null; setUrl(await criarAcessoVideo(token, video!.id, "reproduzir")); setExibindo("original"); }); }}><Play className="h-4 w-4 shrink-0" /><span><strong className="block">Vídeo original</strong><small className="block font-normal opacity-80">{exibindo === "original" ? "Em exibição" : "Alterar para o original"}</small></span></Button>
        </div>
        <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{exibindo === "final" ? "Ativo: vídeo editado com narração e legendas." : exibindo === "original" ? "Ativo: gravação original enviada, sem a edição final." : "Preparando o vídeo padrão para reprodução…"}</p>
        <nav aria-label="Cenas do tutorial" className="mt-5 flex max-h-96 flex-col gap-2 overflow-y-auto">
          {blocos.map((bloco, indice) => <button key={bloco.id || `novo-${indice}`} onClick={() => { void executar(() => trecho(indice)); }} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selecionado === indice ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted font-mono text-xs">{String(indice + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{bloco.acao_visual}</span><span className="text-xs text-muted-foreground">{segundos(bloco.inicio_ms)}–{segundos(bloco.fim_ms)} · {bloco.narracaoGerada ? `voz ${segundos(bloco.narracaoGerada.duracao_ms ?? 0)}` : "voz ainda não medida"}</span></span>{bloco.narracaoGerada?.status === "ajuste_necessario" && <span className="text-xs text-destructive">Revisar</span>}
          </button>)}
        </nav>
      </div>
      <div className="min-w-0 space-y-5">
        {cena ? <div className="rounded-xl border p-4"><div className="flex justify-between"><h3 className="font-semibold">Cena {selecionado + 1} de {blocos.length}</h3><span className="text-xs text-muted-foreground">Confiança visual: {Math.round((cena.confianca ?? 0) * 100)}%</span></div>
          <div className="mt-4 rounded-lg bg-muted p-3"><p className="text-xs font-medium">Ação identificada</p><p className="mt-1 text-sm">{cena.acao_visual}</p><p className="mt-2 text-xs text-muted-foreground">Trecho: {segundos(cena.inicio_ms)}–{segundos(cena.fim_ms)}</p></div>
          <label htmlFor="narracao-editor" className="mt-3 block text-xs font-medium">Legenda e narração <span className="font-normal text-muted-foreground">· único texto editável</span></label><textarea id="narracao-editor" aria-label="Narração" className={campo} rows={5} maxLength={4000} disabled={bloqueado} value={cena.narracao} onChange={(event) => editar({ narracao: event.target.value })} />
          <p className="mt-3 text-xs text-muted-foreground">Janela: {segundos(cena.fim_ms - cena.inicio_ms)} · Estimativa de fala: {segundos(cena.narracao.trim().split(/\s+/).filter(Boolean).length * 400)} · Real: {cena.narracaoGerada?.duracao_ms ? segundos(cena.narracaoGerada.duracao_ms) : "não medida"}</p>
          {cena.narracaoGerada && <p className={`mt-2 text-xs ${cena.narracaoGerada.status === "ajuste_necessario" ? "text-destructive" : "text-primary"}`}>{cena.narracaoGerada.status.replaceAll("_", " ")} · aceleração {((cena.narracaoGerada.taxa_aceleracao ?? 1) - 1) * 100 > 12 ? "revisão necessária" : `${(((cena.narracaoGerada.taxa_aceleracao ?? 1) - 1) * 100).toFixed(1)}%`}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={bloqueado || cena.fim_ms - cena.inicio_ms < 2} onClick={() => { setBlocos(dividirBloco(blocos, selecionado)); setAlterado(true); }}><Scissors className="h-4 w-4" />Dividir</Button><Button variant="outline" disabled={bloqueado || selecionado >= blocos.length - 1} onClick={() => { setBlocos(unirBlocos(blocos, selecionado)); setAlterado(true); }}>Unir à próxima</Button><Button disabled={bloqueado || !alterado} onClick={() => { void executar(salvar); }}><Save className="h-4 w-4" />Salvar alterações</Button><Button variant="ghost" disabled={!alterado} onClick={() => { setBlocos(roteiro?.blocos ?? []); setAlterado(false); setSelecionado(0); }}><Undo2 className="h-4 w-4" />Descartar</Button></div>
          <div className="mt-3 flex flex-wrap gap-2">{cena.narracaoGerada?.arquivo_id && <><Button variant="ghost" onClick={() => { void executar(() => abrir(cena.narracaoGerada!.arquivo_id!, "ouvir")); }}><Volume2 className="h-4 w-4" />Ouvir</Button><Button variant="ghost" onClick={() => { void executar(() => abrir(cena.narracaoGerada!.arquivo_id!)); }}><Download className="h-4 w-4" />MP3</Button></>}<Button variant="ghost" disabled={bloqueado || alterado || !cena.id || !consentimento} onClick={() => { void executar(() => narrar(cena.id)); }}>Regenerar este bloco</Button></div>
        </div> : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Importe e valide um MP4 para gerar as cenas do tutorial.</div>}
        <div className="rounded-xl border p-4"><h3 className="font-semibold">Próximo passo: preparar o tutorial</h3><p className="mt-1 text-xs text-muted-foreground">Escolha o nível de processamento e o tom. O restante acontece sozinho.</p><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs">Processamento<select className={campo} value={modelo} onChange={(event) => setModelo(event.target.value as typeof modelo)}><option value="gpt-6.1-sol">Padrão</option><option value="gpt-6-astra">Avançado</option></select></label><label className="text-xs">Tom · pt-BR<select className={campo} value={tom} onChange={(event) => setTom(event.target.value as typeof tom)}><option value="conversado">Conversado</option><option value="natural">Natural</option></select></label></div><label className="mt-4 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"><input className="mt-1" type="checkbox" checked={automatico} onChange={(event) => setAutomatico(event.target.checked)} /><span><strong className="block">Gerar roteiro + narração de uma vez</strong><span className="mt-1 block text-xs text-muted-foreground">Usa a voz padrão, ajusta o ritmo e entrega o MP4 com legendas.</span></span></label><label className="mt-3 flex items-start gap-2 text-xs leading-5"><input className="mt-1" type="checkbox" checked={consentimento} onChange={(event) => setConsentimento(event.target.checked)} />Autorizo o processamento das imagens e do texto deste tutorial. Tenho autorização para usar esse conteúdo.</label><p className="mt-2 text-xs text-muted-foreground">Esta ação pode consumir créditos conforme a duração do vídeo.</p><Button className="mt-3" disabled={bloqueado || !consentimento || !video || video.status !== "pronto"} onClick={() => { const acao = automatico ? "gerar o roteiro e o vídeo narrado" : "gerar somente o roteiro"; if (window.confirm(`O processamento vai ${acao} e pode consumir créditos. Continuar?`)) void executar(async () => { await solicitarAnalise(token, video!.id, Boolean(roteiro), { modelo, tom, narrarAoConcluir: automatico }); await aoAtualizar(); }); }}>{automatico ? "Criar tutorial completo" : roteiro ? "Gerar nova versão" : "Gerar somente o roteiro"}</Button></div>
        {roteiro && <div className="rounded-xl border p-4"><h3 className="font-semibold">Narrar vídeo</h3><p className="mt-1 text-xs text-muted-foreground">A voz principal já vem selecionada; escolha a alternativa somente quando necessário.</p><label className="mt-3 block text-xs">Voz<select className={campo} value={opcoes.vozId ?? ""} onChange={(event) => setOpcoes({ ...opcoes, vozId: event.target.value })}>{configuracoes?.vozes.map((voz) => <option key={voz.id} value={voz.id}>{voz.nome}{voz.padrao ? " · padrão" : " · opcional"}</option>)}</select></label><label className="mt-3 block text-xs">Áudio original<select className={campo} value={opcoes.modoAudio} onChange={(event) => setOpcoes({ ...opcoes, modoAudio: event.target.value as OpcoesNarracao["modoAudio"] })}><option value="substituir">Substituir pela narração</option><option value="ducking">Manter baixo durante a narração</option><option value="manter_original">Misturar com áudio original</option></select></label><label className="mt-3 flex gap-2 text-xs"><input type="checkbox" checked={opcoes.ajustarTextoAutomaticamente} onChange={(event) => setOpcoes({ ...opcoes, ajustarTextoAutomaticamente: event.target.checked })} />Ajustar texto automaticamente (até 2 tentativas por bloco longo)</label><label className="mt-3 flex gap-2 text-xs"><input type="checkbox" checked={opcoes.gerarLegendas} onChange={(event) => setOpcoes({ ...opcoes, gerarLegendas: event.target.checked })} />Gerar arquivos de legenda</label><div className="mt-4 flex flex-wrap gap-2"><Button disabled={bloqueado || alterado || !consentimento} onClick={() => { void executar(() => narrar()); }}><Mic2 className="h-4 w-4" />Gerar / refazer vídeo</Button><Button variant="outline" disabled={bloqueado || alterado || !consentimento} onClick={() => { void executar(() => narrar(undefined, true)); }}>Regenerar voz completa</Button></div></div>}
      </div>
    </div>
    {!!arquivosRender.length && <div className="mt-6 border-t pt-5"><h3 className="font-semibold">Resultados e histórico de renders</h3><div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">{arquivosRender.map((arquivo) => <Button key={arquivo.id} variant="outline" onClick={() => { void executar(() => abrir(arquivo.id)); }}><Download className="h-4 w-4" />{arquivo.tipo === "video_final" ? "MP4" : arquivo.mime_type === "audio/wav" ? "WAV" : arquivo.mime_type === "text/vtt" ? "VTT" : "SRT"} · {new Date(arquivo.criado_em).toLocaleString("pt-BR")}</Button>)}</div></div>}
    {!!roteiro?.historico.length && <details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Histórico de edições / desfazer</summary><div className="mt-3 flex flex-wrap gap-2">{roteiro.historico.map((evento) => <Button key={evento.id} variant="outline" disabled={bloqueado} onClick={() => { const dados = snapshotSchema.safeParse(evento.dados); if (!dados.success) { setErro("Esta edição antiga não possui snapshot restaurável."); return; } setBlocos(dados.data.antes.map((bloco, indice) => ({ ...roteiro.blocos[0]!, id: roteiro.blocos.some((atual) => atual.id === bloco.id) ? bloco.id : "", ordem: indice, inicio_ms: bloco.inicioMs, fim_ms: bloco.fimMs, acao_visual: bloco.acaoVisual, narracao: bloco.narracao, evidencias_frame: bloco.evidenciasFrame, confianca: bloco.confianca, narracaoGerada: null, duracaoDisponivelMs: bloco.fimMs - bloco.inicioMs }))); setSelecionado(0); setAlterado(true); }}>Restaurar antes de {new Date(evento.criado_em).toLocaleString("pt-BR")}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">Revise a versão restaurada e clique em Salvar alterações.</p></details>}
  </section>;
}
