import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, Camera, CheckCircle2, Copy, FileVideo, FolderOpen, ImageIcon, ImageUp, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { corsArquivo, criarAcessoArquivo, criarAcessoVideo, editarProjeto, salvarThumbnail, type EmpresaEstudio, type ProjetoEstudio } from "@/lib/estudio-api";

const campo = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const terminal = new Set(["concluido", "erro", "cancelado", "roteiro_pronto", "ajuste_necessario"]);
const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
const capas = new Map<string, Promise<string>>();
type FonteMiniatura = { chave: string; src: string; imagem: boolean };


function desenharQuadrado(fonte: CanvasImageSource, largura: number, altura: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const lado = Math.min(largura, altura), x = (largura - lado) / 2, y = (altura - lado) / 2;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar a miniatura.");
  contexto.drawImage(fonte, x, y, lado, lado, 0, 0, 512, 512);
  return canvas;
}

function canvasParaBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a miniatura.")), "image/jpeg", 0.86));
}

function capturarCapa(src: string): Promise<string> {
  const existente = capas.get(src);
  if (existente) return existente;
  const captura = new Promise<string>((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto"; video.crossOrigin = corsArquivo(src);
    const limpar = () => { video.removeAttribute("src"); video.load(); };
    const desenhar = () => {
      try { const imagem = desenharQuadrado(video, video.videoWidth, video.videoHeight).toDataURL("image/jpeg", 0.78); limpar(); resolve(imagem); }
      catch (error) { limpar(); reject(error instanceof Error ? error : new Error("THUMBNAIL_CAPTURE_FAILED")); }
    };
    video.onerror = () => { limpar(); reject(new Error("THUMBNAIL_LOAD_FAILED")); };
    video.onloadedmetadata = () => {
      video.onseeked = () => typeof video.requestVideoFrameCallback === "function" ? video.requestVideoFrameCallback(desenhar) : requestAnimationFrame(desenhar);
      video.currentTime = Math.min(1, Math.max(0.05, video.duration / 20));
    };
    video.src = src;
  }).catch((error) => { capas.delete(src); throw error; });
  capas.set(src, captura);
  return captura;
}

function Miniatura({ fonte, titulo, compacta = false }: { fonte?: FonteMiniatura; titulo: string; compacta?: boolean }) {
  const [capturada, setCapturada] = useState<{ chave: string; src: string } | null>(null);
  useEffect(() => {
    let ativa = true;
    if (fonte && !fonte.imagem) void capturarCapa(fonte.src).then((src) => { if (ativa) setCapturada({ chave: fonte.chave, src }); }).catch(() => undefined);
    return () => { ativa = false; };
  }, [fonte]);
  const capa = fonte?.imagem ? fonte.src : capturada && capturada.chave === fonte?.chave ? capturada.src : "";
  return <div className={`${compacta ? "h-12 w-12" : "h-24 w-24 sm:h-28 sm:w-28"} shrink-0 overflow-hidden rounded-lg bg-muted`}>
    {capa ? <img aria-label={`Miniatura de ${titulo}`} alt="" src={capa} className="h-full w-full object-cover" /> : fonte ? <video aria-label={`Miniatura de ${titulo}`} src={`${fonte.src}#t=0.1`} crossOrigin={corsArquivo(fonte.src)} muted playsInline preload="auto" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><FileVideo className="h-6 w-6 text-muted-foreground" /></div>}
  </div>;
}

function EditorMiniatura({ projeto, token, aoFechar, aoSalvar }: { projeto: ProjetoEstudio; token: string; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const video = projeto.videos[0];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { if (video) void criarAcessoVideo(token, video.id, "reproduzir").then(setSrc).catch((error: unknown) => setErro(error instanceof Error ? error.message : "Não foi possível abrir o vídeo.")); }, [token, video]);

  async function persistir(imagem: Blob) {
    setSalvando(true); setErro("");
    try { await salvarThumbnail(token, projeto.id, imagem); await aoSalvar(); aoFechar(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar a miniatura."); }
    finally { setSalvando(false); }
  }

  async function usarQuadroAtual() {
    const elemento = videoRef.current;
    if (!elemento?.videoWidth) return setErro("Aguarde o vídeo carregar.");
    await persistir(await canvasParaBlob(desenharQuadrado(elemento, elemento.videoWidth, elemento.videoHeight)));
  }

  async function usarArquivo(arquivo?: File) {
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/") || arquivo.size > 10 * 1024 * 1024) return setErro("Escolha uma imagem de até 10 MB.");
    try {
      const imagem = await createImageBitmap(arquivo);
      try { await persistir(await canvasParaBlob(desenharQuadrado(imagem, imagem.width, imagem.height))); }
      finally { imagem.close(); }
    } catch { setErro("Não foi possível ler essa imagem."); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !salvando) aoFechar(); }}><section role="dialog" aria-modal="true" aria-labelledby="titulo-editor-miniatura" className="hub-card w-full max-w-2xl rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Miniatura</p><h2 id="titulo-editor-miniatura" className="mt-1 text-lg font-semibold">Editar capa de {projeto.titulo}</h2><p className="mt-1 text-xs text-muted-foreground">Pause no melhor momento ou envie uma imagem. O corte quadrado é automático.</p></div><Button size="icon" variant="ghost" aria-label="Fechar editor" disabled={salvando} onClick={aoFechar}><X className="h-4 w-4" /></Button></div>
    {src ? <video ref={videoRef} src={src} crossOrigin={corsArquivo(src)} controls playsInline className="mt-4 aspect-video w-full rounded-xl bg-black object-contain" /> : <div className="mt-4 grid aspect-video place-items-center rounded-xl bg-muted text-sm text-muted-foreground">Carregando vídeo…</div>}
    {erro && <p role="alert" className="mt-3 text-sm text-destructive">{erro}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button disabled={salvando || !src} onClick={() => { void usarQuadroAtual(); }}><Camera className="h-4 w-4" />Usar quadro atual</Button><label className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent ${salvando ? "pointer-events-none opacity-50" : ""}`}><ImageUp className="h-4 w-4" />Enviar imagem<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={salvando} onChange={(event) => { void usarArquivo(event.target.files?.[0]); }} /></label></div></section></div>;
}

function EditorMetadados({ projeto, empresas, token, aoFechar, aoSalvar }: { projeto: ProjetoEstudio; empresas: EmpresaEstudio[]; token: string; aoFechar: () => void; aoSalvar: () => Promise<void> }) {
  const empresaInicial = projeto.empresa_id ?? empresas.find((empresa) => empresa.nome === projeto.empresa)?.id ?? "";
  const [titulo, setTitulo] = useState(projeto.titulo);
  const [descricao, setDescricao] = useState(projeto.descricao);
  const [tags, setTags] = useState(projeto.tags.join(", "));
  const [empresaId, setEmpresaId] = useState(empresaInicial);
  const [areaId, setAreaId] = useState(projeto.area_id ?? empresas.find((empresa) => empresa.id === empresaInicial)?.areas.find((area) => area.nome === projeto.setor)?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const areas = empresas.find((empresa) => empresa.id === empresaId)?.areas ?? [];

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const listaTags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (listaTags.length > 20) return setErro("Use no máximo 20 tags separadas por vírgula.");
    if (listaTags.some((tag) => tag.length > 40)) return setErro("Cada tag pode ter no máximo 40 caracteres.");
    if (!areaId) return setErro("Selecione a empresa e a área.");
    setSalvando(true); setErro("");
    try {
      await editarProjeto(token, projeto.id, { titulo: titulo.trim(), descricao: descricao.trim(), tags: listaTags, areaId });
      await aoSalvar(); aoFechar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar as informações."); }
    finally { setSalvando(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !salvando) aoFechar(); }}><section role="dialog" aria-modal="true" aria-labelledby="titulo-editor-metadados" className="hub-card max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Informações do tutorial</p><h2 id="titulo-editor-metadados" className="mt-1 text-lg font-semibold">Editar metadados</h2><p className="mt-1 text-xs text-muted-foreground">Atualize como este conteúdo será encontrado e organizado.</p></div><Button size="icon" variant="ghost" aria-label="Fechar editor" disabled={salvando} onClick={aoFechar}><X className="h-4 w-4" /></Button></div>
    <form className="mt-5 space-y-4" onSubmit={(event) => { void salvar(event); }}><label className="block text-xs font-medium">Título<input required maxLength={160} className={`${campo} mt-2`} value={titulo} onChange={(event) => setTitulo(event.target.value)} /></label><label className="block text-xs font-medium">Descrição<textarea maxLength={2000} rows={5} className={`${campo} mt-2`} value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Explique rapidamente o objetivo deste tutorial." /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium">Empresa<select required className={`${campo} mt-2`} value={empresaId} onChange={(event) => { setEmpresaId(event.target.value); setAreaId(""); }}><option value="">Selecione</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select></label><label className="text-xs font-medium">Área<select required disabled={!empresaId} className={`${campo} mt-2`} value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">Selecione</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}</select></label></div><label className="block text-xs font-medium">Tags<input maxLength={819} className={`${campo} mt-2`} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Ex.: financeiro, compras, aprovação" /><span className="mt-1 block font-normal text-muted-foreground">Separe por vírgulas. Máximo de 20 tags, com 40 caracteres cada.</span></label>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" disabled={salvando} onClick={aoFechar}>Cancelar</Button><Button type="submit" disabled={salvando || !titulo.trim()}>{salvando ? "Salvando…" : "Salvar informações"}</Button></div></form>
  </section></div>;
}

export function BibliotecaTutoriais({ projetos, empresas, carregando, token, projetoId, progresso, podeExcluir, aoEditar, aoVerTutorial, aoDuplicar, aoExcluir, aoAtualizar }: {
  projetos: ProjetoEstudio[]; carregando: boolean; token: string; projetoId: string | null; progresso: number | null;
  empresas: EmpresaEstudio[];
  podeExcluir: boolean;
  aoEditar: (id: string) => void; aoVerTutorial: (id: string) => void; aoDuplicar: (projeto: ProjetoEstudio) => void; aoExcluir: (projeto: ProjetoEstudio) => void; aoAtualizar: () => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [buscaFocada, setBuscaFocada] = useState(false);
  const [fontes, setFontes] = useState<Record<string, FonteMiniatura>>({});
  const [editando, setEditando] = useState<ProjetoEstudio | null>(null);
  const [metadados, setMetadados] = useState<ProjetoEstudio | null>(null);
  const solicitadas = useRef(new Set<string>());

  useEffect(() => {
    for (const projeto of projetos) {
      const video = projeto.videos[0], chave = projeto.thumbnail?.id ?? video?.id;
      if (!chave || fontes[projeto.id]?.chave === chave || solicitadas.current.has(chave)) continue;
      solicitadas.current.add(chave);
      const acesso = projeto.thumbnail ? criarAcessoArquivo(token, projeto.thumbnail.id, "reproduzir") : criarAcessoVideo(token, video!.id, "reproduzir");
      void acesso.then((src) => setFontes((atuais) => ({ ...atuais, [projeto.id]: { chave, src, imagem: Boolean(projeto.thumbnail) } }))).catch(() => solicitadas.current.delete(chave));
    }
  }, [projetos, token, fontes]);

  const termo = normalizar(busca.trim());
  const resultados = projetos.filter((projeto) => { const status = projeto.processamentos[0]?.status ?? projeto.status, texto = normalizar(`${projeto.titulo} ${projeto.descricao} ${projeto.tags.join(" ")} ${projeto.empresa} ${projeto.setor} ${projeto.videos[0]?.nome_original ?? ""}`); return (!termo || texto.includes(termo)) && (!filtro || status === filtro); });
  const sugestoes = (termo ? resultados : projetos).slice(0, 6);
  const pastas = resultados.reduce<Record<string, Record<string, ProjetoEstudio[]>>>((agrupadas, projeto) => { (agrupadas[projeto.empresa] ??= {})[projeto.setor] ??= []; agrupadas[projeto.empresa]![projeto.setor]!.push(projeto); return agrupadas; }, {});
  const pronto = (projeto: ProjetoEstudio) => projeto.status === "concluido" || projeto.processamentos.some((item) => item.status === "concluido" && item.tipo === "gerar_narracao");
  const abrir = (projeto: ProjetoEstudio) => pronto(projeto) ? aoVerTutorial(projeto.id) : aoEditar(projeto.id);

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="font-semibold">Biblioteca · {projetos.length}</h2><div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto"><div className="relative min-w-64 flex-1 sm:w-96"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input role="combobox" aria-label="Buscar tutorial" aria-autocomplete="list" aria-expanded={buscaFocada && sugestoes.length > 0} className={`${campo} pl-9`} placeholder="Busque por tutorial, empresa ou setor" value={busca} onFocus={() => setBuscaFocada(true)} onBlur={() => setBuscaFocada(false)} onChange={(event) => setBusca(event.target.value)} />{buscaFocada && sugestoes.length > 0 && <div role="listbox" aria-label="Sugestões de tutoriais" className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border bg-background p-2 shadow-xl">{sugestoes.map((projeto) => <button role="option" aria-selected={projeto.id === projetoId} key={projeto.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { abrir(projeto); setBusca(projeto.titulo); setBuscaFocada(false); }} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Miniatura compacta fonte={fontes[projeto.id]} titulo={projeto.titulo} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{projeto.titulo}</span><span className="block truncate text-xs text-muted-foreground">{projeto.empresa} › {projeto.setor}</span></span></button>)}</div>}</div><select aria-label="Filtrar status" className={`${campo} w-auto`} value={filtro} onChange={(event) => setFiltro(event.target.value)}><option value="">Todos os status</option>{[...new Set(projetos.map((projeto) => projeto.processamentos[0]?.status ?? projeto.status))].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div></div>
    {carregando ? <p className="text-sm text-muted-foreground">Carregando biblioteca…</p> : !projetos.length ? <div className="hub-card rounded-2xl p-10 text-center"><FileVideo className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-3 font-semibold">Crie seu primeiro tutorial</h3><p className="mt-2 text-sm text-muted-foreground">Abra Criar vídeo no menu e siga o passo a passo.</p></div> : !resultados.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum tutorial encontrado. Tente outro termo ou filtro.</div> : <div className="space-y-5">{Object.entries(pastas).map(([empresa, setores]) => <section key={empresa} className="rounded-2xl border p-4"><h3 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-primary" />{empresa}</h3><div className="mt-4 space-y-5">{Object.entries(setores).map(([setor, itens]) => <div key={setor}><h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground"><FolderOpen className="h-4 w-4" />{setor} · {itens.length}</h4><div className="space-y-2">{itens.map((projeto) => { const video = projeto.videos[0], processamento = projeto.processamentos[0], estaPronto = pronto(projeto); return <article key={projeto.id} className={`hub-card flex gap-3 rounded-xl border p-3 sm:gap-4 ${projeto.id === projetoId ? "border-primary" : ""}`}><button type="button" className="relative shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => abrir(projeto)}><Miniatura fonte={fontes[projeto.id]} titulo={projeto.titulo} /><span className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-semibold ${estaPronto ? "bg-emerald-600 text-white" : "bg-slate-950/80 text-white"}`}>{estaPronto ? "PRONTO" : "ORIGINAL"}</span></button><div className="min-w-0 flex-1 py-1"><button className="max-w-full text-left focus-visible:ring-2 focus-visible:ring-ring" onClick={() => abrir(projeto)}><h3 className="truncate text-sm font-semibold sm:text-base">{projeto.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{video?.duracao_ms ? `${(video.duracao_ms / 1000).toFixed(1)}s` : "Aguardando MP4"} · {new Date(projeto.criado_em).toLocaleDateString("pt-BR")}</p></button><p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{projeto.descricao || processamento?.mensagem || projeto.status.replaceAll("_", " ")}</p>{!!projeto.tags.length && <div className="mt-2 flex flex-wrap gap-1">{projeto.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>)}</div>}{processamento && !terminal.has(processamento.status) && <progress aria-label={`Progresso de ${projeto.titulo}`} className="mt-2 h-1.5 w-full accent-primary" max={100} value={processamento.progresso} />}</div><div className="flex shrink-0 flex-col items-end justify-between gap-2"><div className="flex"><Button size="icon" variant="ghost" title="Editar informações" aria-label={`Editar informações de ${projeto.titulo}`} onClick={() => setMetadados(projeto)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Editar miniatura" aria-label={`Editar miniatura de ${projeto.titulo}`} disabled={!video} onClick={() => setEditando(projeto)}><ImageIcon className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Duplicar ${projeto.titulo}`} disabled={!video || video.status !== "pronto" || progresso !== null} onClick={() => aoDuplicar(projeto)}><Copy className="h-4 w-4" /></Button>{podeExcluir && <Button size="icon" variant="ghost" title="Excluir tutorial e arquivos" aria-label={`Excluir tutorial e arquivos de ${projeto.titulo}`} onClick={() => aoExcluir(projeto)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div><div className="flex flex-wrap justify-end gap-2">{estaPronto && <Button variant="outline" onClick={() => aoEditar(projeto.id)}><SquarePen className="h-4 w-4" />Editar tutorial</Button>}<Button onClick={() => abrir(projeto)}>{estaPronto ? <><CheckCircle2 className="h-4 w-4" />Ver tutorial</> : "Continuar"}</Button></div></div></article>; })}</div></div>)}</div></section>)}</div>}
    {editando && <EditorMiniatura projeto={editando} token={token} aoFechar={() => setEditando(null)} aoSalvar={aoAtualizar} />}
    {metadados && <EditorMetadados projeto={metadados} empresas={empresas} token={token} aoFechar={() => setMetadados(null)} aoSalvar={aoAtualizar} />}
  </section>;
}
