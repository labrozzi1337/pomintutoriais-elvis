import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Camera, ChevronRight, Image, Inbox, LifeBuoy, ListChecks, Loader2, Plus, Send, Trash2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { cancelarChamado, comentar, criarChamado, listarChamados, listarComentarios, separarAnexos, type SacComment, type SacConfig, type SacTicket } from "./sacClient";

const SacContext = createContext<{ config: SacConfig; open: (tab?: "new" | "list") => void; close: () => void } | null>(null);
const status: Record<string, string> = { open: "Aberto", in_analysis: "Em análise", in_progress: "Em andamento", waiting_user: "Aguardando você", resolved: "Resolvido", closed: "Fechado", cancelled: "Cancelado" };

function useSac() {
  const contexto = useContext(SacContext);
  if (!contexto) throw new Error("SAC_CONTEXT_MISSING");
  return contexto;
}

export function SacProvider({ config, children }: { config: SacConfig; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "list">("new");
  const valor = useMemo(() => ({ config, open: (inicial: "new" | "list" = "new") => { setTab(inicial); setOpen(true); }, close: () => setOpen(false) }), [config]);
  return <SacContext.Provider value={valor}>{children}<SacDrawer open={open} tab={tab} setTab={setTab} onClose={() => setOpen(false)} /></SacContext.Provider>;
}

export function SacTicketButton() {
  const { open } = useSac();
  return <button type="button" onClick={() => open("new")} aria-label="Abrir chamado" title="Abrir chamado" className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-muted/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><LifeBuoy className="h-[17px] w-[17px]" /></button>;
}

function SacDrawer({ open, tab, setTab, onClose }: { open: boolean; tab: "new" | "list"; setTab: (tab: "new" | "list") => void; onClose: () => void }) {
  const [selecionado, setSelecionado] = useState<SacTicket | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => { if (!open) return; const fechar = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", fechar); return () => window.removeEventListener("keydown", fechar); }, [onClose, open]);
  return <aside data-sac-panel role="dialog" aria-label="Chamados" aria-hidden={!open} className={cn("fixed inset-y-0 right-0 z-[70] flex w-full max-w-[430px] flex-col border-l bg-card shadow-2xl transition-transform duration-300", open ? "translate-x-0" : "pointer-events-none translate-x-full")}>
    <header className="flex h-16 items-center gap-3 border-b px-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><LifeBuoy className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block text-sm">Chamados</strong><span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Suporte Pomin</span></div><button type="button" onClick={onClose} aria-label="Fechar chamados" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"><X className="h-4 w-4" /></button></header>
    <div className="flex border-b px-3"><Tab active={tab === "new"} onClick={() => { setTab("new"); setSelecionado(null); }}><Plus className="h-3.5 w-3.5" />Novo chamado</Tab><Tab active={tab === "list"} onClick={() => { setTab("list"); setSelecionado(null); }}><ListChecks className="h-3.5 w-3.5" />Meus chamados</Tab></div>
    {open && <div className="flex-1 overflow-y-auto">{tab === "new" ? <NovoChamado onCreated={(ticket) => { setSelecionado(ticket); setTab("list"); setVersao((atual) => atual + 1); }} /> : selecionado ? <Detalhe ticket={selecionado} onBack={() => setSelecionado(null)} onChanged={() => setVersao((atual) => atual + 1)} /> : <Lista key={versao} onSelect={setSelecionado} />}</div>}
  </aside>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("relative inline-flex items-center gap-1.5 px-3 py-3 text-xs font-medium", active ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground")}>{children}</button>;
}

function NovoChamado({ onCreated }: { onCreated: (ticket: SacTicket) => void }) {
  const { config, close } = useSac();
  const [titulo, setTitulo] = useState(""); const [descricao, setDescricao] = useState(""); const [tipo, setTipo] = useState("bug"); const [prioridade, setPrioridade] = useState("medium");
  const [anexo, setAnexo] = useState<Blob | null>(null); const [preview, setPreview] = useState(""); const [capturando, setCapturando] = useState(false); const [enviando, setEnviando] = useState(false); const [erro, setErro] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function selecionar(blob: Blob) { if (preview) URL.revokeObjectURL(preview); setAnexo(blob); setPreview(URL.createObjectURL(blob)); }
  async function capturar() {
    setCapturando(true); setErro(""); const painel = document.querySelector<HTMLElement>("[data-sac-panel]"); const display = painel?.style.display;
    try { if (painel) painel.style.display = "none"; await new Promise((resolve) => setTimeout(resolve, 80)); const { toBlob } = await import("html-to-image"); const blob = await toBlob(document.body, { cacheBust: true, pixelRatio: Math.min(devicePixelRatio || 1, 2), backgroundColor: getComputedStyle(document.body).backgroundColor || "#fff" }); if (!blob) throw new Error("Falha ao capturar a tela."); selecionar(blob); }
    catch (error) { setErro(error instanceof Error ? error.message : "Falha ao capturar a tela."); }
    finally { if (painel) painel.style.display = display ?? ""; setCapturando(false); }
  }
  async function enviar(event: FormEvent) {
    event.preventDefault(); setErro(""); setEnviando(true);
    try { onCreated(await criarChamado(config, { title: titulo, description: descricao, type: tipo, priority: prioridade }, anexo)); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível abrir o chamado."); }
    finally { setEnviando(false); }
  }
  return <form onSubmit={(event) => { void enviar(event); }} className="space-y-4 p-5"><div className="grid grid-cols-2 gap-3"><Campo label="Tipo"><select value={tipo} onChange={(event) => setTipo(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="bug">Erro / Bug</option><option value="improvement">Melhoria</option><option value="feature">Nova funcionalidade</option><option value="task">Tarefa</option><option value="question">Dúvida</option></select></Campo><Campo label="Prioridade"><select value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></Campo></div>
    <Campo label="Título"><input required maxLength={140} value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Resuma o que aconteceu" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" /></Campo><Campo label="Descrição"><textarea required rows={6} value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Explique o problema, o resultado esperado e como reproduzir." className="w-full rounded-lg border bg-background px-3 py-2 text-sm" /></Campo>
    <Campo label="Captura de tela">{preview ? <div className="relative overflow-hidden rounded-xl border"><img src={preview} alt="Prévia da captura" className="max-h-52 w-full object-cover" /><button type="button" aria-label="Remover captura" onClick={() => { setAnexo(null); setPreview(""); }} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-card/90"><Trash2 className="h-4 w-4 text-destructive" /></button></div> : <div className="grid grid-cols-2 gap-2"><button type="button" disabled={capturando} onClick={() => { void capturar(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-sm hover:bg-muted">{capturando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Capturar tela</button><button type="button" onClick={() => arquivo.current?.click()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-sm hover:bg-muted"><Image className="h-4 w-4" />Anexar imagem</button><input ref={arquivo} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) selecionar(file); }} /></div>}</Campo>
    {erro && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={close} className="h-10 rounded-lg px-4 text-sm text-muted-foreground hover:bg-muted">Cancelar</button><button type="submit" disabled={enviando} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}{enviando ? "Enviando…" : "Abrir chamado"}</button></div></form>;
}

function Campo({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs font-medium text-muted-foreground"><span className="mb-1.5 block uppercase tracking-[0.08em]">{label}</span>{children}</label>; }

function Lista({ onSelect }: { onSelect: (ticket: SacTicket) => void }) {
  const { config } = useSac(); const [tickets, setTickets] = useState<SacTicket[]>([]); const [carregando, setCarregando] = useState(true); const [erro, setErro] = useState("");
  useEffect(() => { let ativo = true; void listarChamados(config).then((dados) => { if (ativo) setTickets(dados); }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Falha ao carregar chamados."); }).finally(() => { if (ativo) setCarregando(false); }); return () => { ativo = false; }; }, [config]);
  if (carregando) return <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando chamados…</p>;
  if (erro) return <p role="alert" className="m-5 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{erro}</p>;
  if (!tickets.length) return <div className="grid place-items-center p-12 text-center"><Inbox className="h-8 w-8 text-muted-foreground" /><strong className="mt-3 text-sm">Nenhum chamado aberto</strong><p className="mt-1 text-xs text-muted-foreground">Use a aba “Novo chamado” para falar com o suporte.</p></div>;
  return <ul className="divide-y">{tickets.map((ticket) => <li key={ticket.id}><button type="button" onClick={() => onSelect(ticket)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted"><span className="min-w-0 flex-1"><span className="text-[10px] uppercase tracking-wide text-primary">#{ticket.ticket_number} · {status[ticket.status] ?? ticket.status}</span><strong className="mt-1 block truncate text-sm">{ticket.title}</strong><span className="text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleDateString("pt-BR")} · {ticket.comments_count} comentário(s)</span></span><ChevronRight className="h-4 w-4" /></button></li>)}</ul>;
}

function Detalhe({ ticket, onBack, onChanged }: { ticket: SacTicket; onBack: () => void; onChanged: () => void }) {
  const { config } = useSac(); const [comentarios, setComentarios] = useState<SacComment[]>([]); const [resposta, setResposta] = useState(""); const [carregando, setCarregando] = useState(true); const [enviando, setEnviando] = useState(false); const [erro, setErro] = useState(""); const descricao = separarAnexos(ticket.description);
  async function carregar() { setComentarios(await listarComentarios(config, ticket.id)); }
  useEffect(() => { let ativo = true; void listarComentarios(config, ticket.id).then((dados) => { if (ativo) setComentarios(dados); }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Falha ao carregar comentários."); }).finally(() => { if (ativo) setCarregando(false); }); return () => { ativo = false; }; }, [config, ticket.id]);
  async function responder() { if (!resposta.trim()) return; setEnviando(true); setErro(""); try { await comentar(config, ticket.id, resposta); setResposta(""); await carregar(); onChanged(); } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao responder."); } finally { setEnviando(false); } }
  async function cancelar() { if (!window.confirm("Cancelar este chamado?")) return; try { await cancelarChamado(config, ticket.id); onChanged(); onBack(); } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao cancelar."); } }
  return <div className="p-5"><button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" />Voltar</button><div className="mt-4 rounded-xl border bg-muted/30 p-4"><span className="text-[10px] uppercase tracking-wide text-primary">#{ticket.ticket_number} · {status[ticket.status] ?? ticket.status}</span><h3 className="mt-2 font-semibold">{ticket.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{descricao.texto}</p>{descricao.anexos.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border"><img src={url} alt="Anexo do chamado" className="w-full" /></a>)}</div><h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversa</h4>{carregando ? <Loader2 className="mt-4 h-4 w-4 animate-spin" /> : <div className="mt-3 space-y-2">{comentarios.map((comentario) => <div key={comentario.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2 text-xs"><strong>{comentario.author_name ?? "Suporte"}</strong><span className="text-muted-foreground">{new Date(comentario.created_at).toLocaleDateString("pt-BR")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm">{comentario.body}</p></div>)}{!comentarios.length && <p className="text-xs text-muted-foreground">A equipe do SAC responderá por aqui.</p>}</div>}{erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}<textarea rows={3} value={resposta} onChange={(event) => setResposta(event.target.value)} placeholder="Adicionar comentário…" className="mt-4 w-full rounded-lg border bg-background p-3 text-sm" /><div className="mt-2 flex justify-between"><button type="button" disabled={!['open','waiting_user'].includes(ticket.status)} onClick={() => { void cancelar(); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:hidden"><XCircle className="h-4 w-4" />Cancelar chamado</button><button type="button" disabled={enviando || !resposta.trim()} onClick={() => { void responder(); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-60">{enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar</button></div></div>;
}
