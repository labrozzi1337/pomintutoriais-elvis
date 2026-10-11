import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Captions, CheckCircle2, Clock3, FileVideo, FolderKanban, Mic2, Play, Sparkles, Video } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { listarProjetos, type ProjetoEstudio } from "@/lib/estudio-api";

const estadosFinais = new Set(["concluido", "erro", "cancelado", "roteiro_pronto", "ajuste_necessario"]);

export function DashboardPage() {
  const { session } = useAuth();
  const [projetos, setProjetos] = useState<ProjetoEstudio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void listarProjetos(session?.access_token ?? "", controller.signal)
      .then(setProjetos)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setErro(error instanceof Error ? error.message : "Não foi possível carregar a visão geral.");
      })
      .finally(() => setCarregando(false));
    return () => controller.abort();
  }, [session?.access_token]);

  const resumo = useMemo(() => {
    const videos = projetos.flatMap((projeto) => projeto.videos);
    const emAndamento = projetos.filter((projeto) => projeto.processamentos.some((job) => !estadosFinais.has(job.status))).length;
    const concluidos = projetos.filter((projeto) => projeto.status === "concluido" || projeto.processamentos.some((job) => job.status === "concluido")).length;
    const duracaoMs = videos.reduce((total, video) => total + (video.duracao_ms ?? 0), 0);
    return { videos: videos.length, emAndamento, concluidos, duracaoMinutos: Math.round(duracaoMs / 60000) };
  }, [projetos]);

  const recentes = [...projetos].sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em)).slice(0, 5);

  return <div className="min-h-full bg-[radial-gradient(circle_at_85%_5%,hsl(var(--primary)/0.10),transparent_30%)] p-4 sm:p-6 lg:p-8">
    <section className="hub-hero relative overflow-hidden rounded-[14px] p-6 text-white sm:p-8 lg:p-10">
      <div className="relative z-10 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-[#7ecce4]" />Estúdio de Tutoriais</span>
        <h1 className="mt-6 max-w-xl text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-4xl lg:text-5xl">Da gravação de tela ao tutorial pronto.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">Centralize seus vídeos, gere roteiros cena por cena, produza a narração e exporte o resultado com legendas.</p>
        <Link to="/criar" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5">Criar novo vídeo <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10 bg-primary/20 blur-3xl" />
    </section>

    {erro && <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}

    <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Metric icon={FolderKanban} label="Projetos" value={carregando ? "—" : String(projetos.length)} detail="na biblioteca" />
      <Metric icon={FileVideo} label="Vídeos" value={carregando ? "—" : String(resumo.videos)} detail={`${resumo.duracaoMinutos} min importados`} />
      <Metric icon={Clock3} label="Em andamento" value={carregando ? "—" : String(resumo.emAndamento)} detail="processando agora" />
      <Metric icon={CheckCircle2} label="Concluídos" value={carregando ? "—" : String(resumo.concluidos)} detail="resultados gerados" />
    </div>

    <section className="mt-8">
      <p className="eyebrow">Fluxo do projeto</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Uma produção, quatro etapas</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Step icon={Video} number="01" title="Capturar" description="Grave a tela pelo navegador ou abra o Recordly no Windows e importe o MP4." />
        <Step icon={Sparkles} number="02" title="Criar roteiro" description="O processamento identifica as cenas e prepara ações visuais e narração em português." />
        <Step icon={Mic2} number="03" title="Narrar" description="Revise o texto, escolha a voz e ajuste cada trecho ao tempo disponível." />
        <Step icon={Captions} number="04" title="Exportar" description="Gere o vídeo final, áudio e legendas SRT e VTT para download." />
      </div>
    </section>

    <section className="mt-8 hub-card rounded-[14px] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">Biblioteca</p><h2 className="mt-1 text-lg font-semibold">Projetos recentes</h2></div>
        <Link to="/tutoriais" className="text-xs font-medium text-primary hover:underline">Ver todos</Link>
      </div>
      {carregando ? <p className="mt-6 text-sm text-muted-foreground">Carregando projetos…</p> : recentes.length === 0 ? <div className="mt-6 rounded-xl border border-dashed p-8 text-center"><Play className="mx-auto h-6 w-6 text-primary" /><p className="mt-3 text-sm font-medium">Nenhum tutorial criado ainda.</p><Link to="/criar" className="mt-2 inline-block text-xs text-primary hover:underline">Criar o primeiro tutorial</Link></div> : <div className="mt-4 divide-y divide-border">{recentes.map((projeto) => {
        const video = projeto.videos[0];
        const status = projeto.processamentos[0]?.status ?? projeto.status;
        return <Link key={projeto.id} to={`/criar?projeto=${projeto.id}`} className="flex items-center gap-3 py-3 transition-colors hover:text-primary">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileVideo className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{projeto.titulo}</span><span className="mt-0.5 block text-xs text-muted-foreground">{video?.duracao_ms ? `${(video.duracao_ms / 1000).toFixed(1)}s` : "Aguardando vídeo"} · {new Date(projeto.criado_em).toLocaleDateString("pt-BR")}</span></span>
          <span className="hidden rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground sm:block">{status.replaceAll("_", " ")}</span><ArrowRight className="h-4 w-4 shrink-0" />
        </Link>;
      })}</div>}
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof FolderKanban; label: string; value: string; detail: string }) {
  return <section className="hub-card rounded-[14px] p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-primary" /></div><strong className="mt-4 block text-2xl font-semibold tracking-tight">{value}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{detail}</span></section>;
}

function Step({ icon: Icon, number, title, description }: { icon: typeof Video; number: string; title: string; description: string }) {
  return <article className="hub-card rounded-[14px] p-5"><div className="flex items-center justify-between"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span><span className="font-mono text-xs text-muted-foreground">{number}</span></div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></article>;
}
