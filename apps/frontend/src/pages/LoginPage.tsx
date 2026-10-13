import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";

function MicrosoftLogo() {
  return <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
    <path fill="#f25022" d="M1 1h10v10H1z" />
    <path fill="#7fba00" d="M12 1h10v10H12z" />
    <path fill="#00a4ef" d="M1 12h10v10H1z" />
    <path fill="#ffb900" d="M12 12h10v10H12z" />
  </svg>;
}

export function LoginPage() {
  const { session, autorizado, acessoNegado, entrar, entrarMicrosoft, configurationError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [sso, setSso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (session && autorizado) return <Navigate to="/tutoriais" replace />;
  if (session && autorizado === null) return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Validando seu acesso…</main>;

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true); setErro(null);
    const mensagem = await entrar(email.trim(), senha);
    setEnviando(false); setErro(mensagem);
    if (!mensagem) await navigate((location.state as { from?: string } | null)?.from ?? "/tutoriais", { replace: true });
  }

  async function acessarMicrosoft() {
    setSso(true); setErro(null);
    const mensagem = await entrarMicrosoft();
    if (mensagem) { setSso(false); setErro(mensagem); }
  }

  const mensagemErro = erro ?? acessoNegado ?? (configurationError ? "Configure as variáveis públicas do Supabase." : null);

  return <div className="relative flex min-h-screen w-full items-center justify-center bg-[radial-gradient(circle_at_85%_10%,hsl(var(--primary)/0.14),transparent_32%)] p-3 text-foreground sm:p-6">
    <Button variant="ghost" className="absolute left-3 top-3 sm:left-6 sm:top-6" onClick={() => { void navigate(-1); }}><ArrowLeft className="h-4 w-4" />Voltar</Button>
    <main className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-[5px] border border-border/60 bg-card shadow-[0_24px_80px_-45px_hsl(var(--foreground)/0.35)] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden min-h-[610px] flex-col justify-between border-r border-border/60 p-8 lg:flex">
        <div className="flex items-center gap-3">
          <div className="brand-logo grid h-10 w-10 place-items-center rounded-[3px] font-display text-base font-bold">T</div>
          <div><p className="font-display text-lg font-semibold tracking-tight">Grupo Pomin</p><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Estúdio de Tutoriais</p></div>
        </div>

        <div className="max-w-md space-y-4">
          <div className="inline-flex rounded border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Aprendizagem guiada</div>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">Transforme processos em tutoriais que todos conseguem seguir.</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Grave, organize, narre e publique o conhecimento da empresa em um fluxo simples e padronizado.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{ titulo: "Criação", texto: "Vídeo em etapas" }, { titulo: "Biblioteca", texto: "Tudo organizado" }, { titulo: "Wiki", texto: "Conhecimento vivo" }].map((item) => <div key={item.titulo} className="hub-card p-4">
            <span className="mb-3 block h-1.5 w-1.5 rounded-full bg-primary" /><p className="text-sm font-medium">{item.titulo}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.texto}</p>
          </div>)}
        </div>
      </section>

      <section className="flex min-h-[610px] items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden"><div className="brand-logo grid h-9 w-9 place-items-center rounded-[3px] font-display text-sm font-bold">T</div><span className="font-display text-lg font-semibold">Estúdio de Tutoriais</span></div>
          <header className="mb-7"><h2 className="font-display text-2xl font-semibold tracking-tight">Entrar no Estúdio</h2><p className="mt-1 text-sm text-muted-foreground">Use o login da Microsoft ou o e-mail e senha cadastrados no Estúdio.</p></header>

          {mensagemErro && <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-[5px] border border-destructive/40 bg-destructive/5 p-3.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div className="min-w-0 text-sm"><p className="font-medium text-destructive">Não foi possível entrar</p><p className="mt-0.5 leading-snug text-muted-foreground">{mensagemErro}</p></div>
          </div>}

          <Button type="button" variant="outline" className="mb-5 w-full justify-center gap-2.5" onClick={() => { void acessarMicrosoft(); }} disabled={sso || enviando || configurationError}>
            <MicrosoftLogo /><span>{sso ? "Conectando…" : "Entrar com Microsoft"}</span>
          </Button>

          <div className="mb-5 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">ou com e-mail</span><span className="h-px flex-1 bg-border" /></div>

          <form onSubmit={(event) => { void enviar(event); }} className="space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">E-mail</label><div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 w-full rounded-[5px] border bg-background pl-10 pr-3 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring" />
            </div></div>
            <div><label htmlFor="senha" className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Senha</label><div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input id="senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" required minLength={8} value={senha} onChange={(event) => setSenha(event.target.value)} className="h-10 w-full rounded-[5px] border bg-background pl-10 pr-10 text-sm outline-none transition-shadow placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring" />
              <button type="button" onClick={() => setMostrarSenha((valor) => !valor)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}>{mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div></div>
            <Button type="submit" className="w-full justify-center" disabled={enviando || sso || configurationError}><span>{enviando ? "Entrando…" : "Entrar"}</span>{!enviando && <ArrowRight className="h-4 w-4" />}</Button>
          </form>
        </div>
      </section>
    </main>
  </div>;
}
