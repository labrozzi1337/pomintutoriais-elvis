import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowLeft, BookOpen, ChevronRight, FolderKanban, LayoutDashboard, LogOut, Menu, Moon, Pin, PinOff, PlusSquare, Search, Settings, Sun, UserRoundCog, Video, X } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { SacProvider, SacTicketButton, type SacConfig } from "@/components/sac";
import { useTheme } from "@/contexts/theme";
import { useAuth } from "@/contexts/auth";
import { getPominsacClient } from "@/integrations/supabase/pominsacClient";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard }, { to: "/tutoriais", label: "Biblioteca", icon: Video },
  { to: "/criar", label: "Criar vídeo", icon: PlusSquare }, { to: "/organizacao", label: "Organização", icon: FolderKanban },
  { to: "/wiki", label: "Wiki", icon: BookOpen }, { to: "/usuarios", label: "Usuários", icon: UserRoundCog },
  { to: "/configuracoes", label: "Configurações", icon: Settings }
];
const routeTitles: Record<string, string> = { "/dashboard": "Visão geral", "/tutoriais": "Biblioteca", "/criar": "Criar vídeo", "/organizacao": "Organização", "/wiki": "Wiki", "/usuarios": "Usuários", "/configuracoes": "Configurações" };

export function HubLayout() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(() => localStorage.getItem("hub-sidebar-pinned") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const auth = useAuth();
  const location = useLocation(); const navigate = useNavigate();
  const expanded = pinned || hovered;
  const title = routeTitles[location.pathname] ?? "Estúdio de Tutoriais";
  const sacConfig = useMemo<SacConfig>(() => ({
    supabase: getPominsacClient(), systemSlug: "pomintutoriais", attachmentUploadToken: import.meta.env.VITE_POMINSAC_ATTACHMENT_TOKEN,
    getCurrentUser: () => { const usuario = auth.session?.user; return usuario?.email ? { authId: usuario.id, email: usuario.email, name: nomeUsuario(usuario) } : null; }
  }), [auth.session]);

  useEffect(() => { localStorage.setItem("hub-sidebar-pinned", String(pinned)); }, [pinned]);
  useEffect(() => { const atalho = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "q") { event.preventDefault(); setSearchOpen((aberta) => !aberta); } }; window.addEventListener("keydown", atalho); return () => window.removeEventListener("keydown", atalho); }, []);

  return <SacProvider config={sacConfig}><div className="brand-shell shell-pomin min-h-screen" style={{ "--shell-left": expanded ? "var(--sb-open)" : "var(--sb-closed)" } as CSSProperties}>
    <aside className="brand-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width,background-color,color] duration-300 ease-hub lg:flex" style={{ width: expanded ? "var(--sb-open)" : "var(--sb-closed)" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Brand expanded={expanded} /><Navigation expanded={expanded} onNavigate={() => undefined} />
      <div className="mt-auto space-y-2 border-t border-border p-2.5"><button type="button" onClick={() => setPinned((value) => !value)} className={cn("flex h-10 w-full items-center gap-3 overflow-hidden rounded-[5px] px-2.5 text-[12px] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.04]", pinned ? "text-primary" : "text-muted-foreground")} aria-label={pinned ? "Desafixar menu" : "Fixar menu"} title={pinned ? "Desafixar menu" : "Fixar menu"}>{pinned ? <PinOff className="h-[17px] w-[17px] shrink-0" /> : <Pin className="h-[17px] w-[17px] shrink-0" />}<span className={cn("whitespace-nowrap transition-opacity", expanded ? "opacity-100" : "opacity-0")}>{pinned ? "Desafixar menu" : "Fixar menu"}</span></button><UserFooter expanded={expanded} /></div>
    </aside>

    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} /><aside className="brand-sidebar relative flex h-full w-[290px] flex-col border-r"><div className="flex items-center justify-between pr-3"><Brand expanded /><Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button></div><Navigation expanded onNavigate={() => setMobileOpen(false)} /><div className="mt-auto border-t p-3"><UserFooter expanded /></div></aside></div>}

    <header className="brand-header fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b px-3 backdrop-blur-xl transition-[padding-left,background-color,color] duration-300 ease-hub sm:px-5 lg:pl-[calc(var(--shell-left)+20px)]">
      <div className="flex min-w-0 items-center gap-1"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><Button variant="ghost" size="icon" aria-label="Voltar" title="Voltar" onClick={() => { void navigate(-1); }}><ArrowLeft className="h-4 w-4" /></Button><div className="flex min-w-0 items-center gap-2 text-[12px] font-semibold sm:text-[13px]"><span className="hidden text-muted-foreground sm:inline">Estúdio</span><ChevronRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" /><span className="truncate">{title}</span></div></div>
      <div className="flex items-center gap-1.5"><button type="button" onClick={() => setSearchOpen(true)} className="hidden h-9 w-56 items-center gap-2 rounded-[7px] border border-border bg-muted/50 px-3 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 md:flex"><Search className="h-3.5 w-3.5" />Buscar em tudo…<kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 text-[9px]">Ctrl Q</kbd></button><Button variant="ghost" size="icon" className="md:hidden" aria-label="Busca global" onClick={() => setSearchOpen(true)}><Search className="h-[18px] w-[18px]" /></Button><SacTicketButton /><Button variant="ghost" size="icon" aria-label="Alternar tema" title="Alternar tema" onClick={toggleTheme}>{theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}</Button></div>
    </header>
    <div className="brand-canvas fixed bottom-2 left-2 right-2 top-[72px] overflow-hidden rounded-[8px] border transition-[left,background-color] duration-300 ease-hub sm:bottom-3 sm:right-3 lg:left-[calc(var(--shell-left)+8px)]"><main className="hub-scroll h-full overflow-y-auto"><Outlet /></main></div>
    <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
  </div></SacProvider>;
}

function nomeUsuario(usuario: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const nome = usuario.user_metadata?.name ?? usuario.user_metadata?.full_name ?? usuario.user_metadata?.display_name;
  return typeof nome === "string" && nome.trim() ? nome.trim() : usuario.email?.split("@")[0] ?? "Usuário";
}

function Brand({ expanded }: { expanded: boolean }) { return <div className="flex h-16 items-center gap-3 overflow-hidden px-[18px]"><div className="brand-logo grid h-8 w-8 shrink-0 place-items-center rounded-[6px] font-display text-sm font-bold">T</div><div className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}><p className="text-sm font-semibold leading-tight">Estúdio de Tutoriais</p><p className="brand-muted text-[9px] uppercase tracking-[0.16em]">Produção guiada</p></div></div>; }

function Navigation({ expanded, onNavigate }: { expanded: boolean; onNavigate: () => void }) {
  const { tipo } = useAuth();
  return <nav className="space-y-1 px-2 py-3" aria-label="Navegação principal"><p className={cn("mb-2 overflow-hidden px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-opacity", expanded ? "opacity-100" : "opacity-0")}>Projeto</p>{navItems.filter(({ to }) => to !== "/usuarios" || tipo === "admin").map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => cn("group relative flex h-10 items-center gap-3 overflow-hidden rounded-[5px] pl-2.5 text-[13px] transition-all", isActive ? "brand-nav-active font-medium ring-1" : "brand-nav-idle")}><Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} /><span className={cn("whitespace-nowrap transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>{label}</span>{expanded && <ChevronRight className="ml-auto mr-3 h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />}</NavLink>)}</nav>;
}

function UserFooter({ expanded }: { expanded: boolean }) {
  const { session, sair, tipo } = useAuth(); const [saindo, setSaindo] = useState(false);
  const nome = session?.user ? nomeUsuario(session.user) : "Usuário";
  async function encerrar() { setSaindo(true); try { await sair(); } finally { setSaindo(false); } }
  return <div className="flex h-11 items-center gap-2 overflow-hidden rounded-md px-2.5"><div className="brand-logo grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold">{nome.slice(0, 2).toLocaleUpperCase()}</div><div className={cn("min-w-0 flex-1 transition-opacity", expanded ? "opacity-100" : "opacity-0")}><p className="truncate text-[12px] font-medium">{nome}</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{tipo === "admin" ? "Administrador" : "Usuário"}</p></div>{expanded && <button type="button" disabled={saindo} onClick={() => { void encerrar(); }} aria-label="Sair da conta" title="Sair da conta" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"><LogOut className="h-4 w-4" /></button>}</div>;
}
