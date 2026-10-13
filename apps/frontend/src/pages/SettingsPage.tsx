import { useEffect, useRef, useState } from "react";
import { Captions, Database, Gauge, LoaderCircle, Mic2, Play, Square } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { obterAmostraVoz, obterConfiguracoes, type ConfiguracoesEstudio } from "@/lib/estudio-api";

export function SettingsPage() {
  const { session } = useAuth();
  const [config, setConfig] = useState<ConfiguracoesEstudio | null>(null);
  const [erro, setErro] = useState("");
  const [carregandoAmostra, setCarregandoAmostra] = useState<string | null>(null);
  const [tocandoAmostra, setTocandoAmostra] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let ativo = true;
    void obterConfiguracoes(session?.access_token ?? "").then((dados) => { if (ativo) setConfig(dados); }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível carregar as configurações."); });
    return () => { ativo = false; };
  }, [session?.access_token]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  async function tocarAmostra(vozId: string) {
    if (tocandoAmostra === vozId) { audio.current?.pause(); setTocandoAmostra(null); return; }
    setErro(""); setCarregandoAmostra(vozId);
    try {
      const blob = await obterAmostraVoz(session?.access_token ?? "", vozId);
      const url = URL.createObjectURL(blob);
      audio.current?.pause();
      const proxima = new Audio(url);
      audio.current = proxima;
      proxima.onended = () => { URL.revokeObjectURL(url); setTocandoAmostra(null); };
      await proxima.play();
      setTocandoAmostra(vozId);
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível gerar a amostra de voz."); }
    finally { setCarregandoAmostra(null); }
  }

  return <div className="mx-auto min-h-full max-w-[1100px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="eyebrow">Configurações</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Padrões do estúdio</h1><p className="mt-2 text-sm text-muted-foreground">Parâmetros usados na geração e no armazenamento dos tutoriais.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    {!config ? !erro && <p className="text-sm text-muted-foreground">Carregando configurações…</p> : <div className="grid gap-4 md:grid-cols-2">
      <section className="hub-card rounded-2xl p-5"><Mic2 className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Vozes da narração</h2><p className="mt-1 text-xs text-muted-foreground">Erick Pomin é a voz padrão. Ouça as amostras antes de escolher a voz no tutorial.</p><div className="mt-4 space-y-2">{config.vozes.map((voz) => <div key={voz.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{voz.nome}</span><span className="text-xs text-muted-foreground">{voz.padrao ? "Aplicada automaticamente" : "Disponível no seletor do tutorial"}</span></span><button type="button" className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60" onClick={() => { void tocarAmostra(voz.id); }} disabled={carregandoAmostra === voz.id} title={`Ouvir exemplo: ${voz.nome}`}>{carregandoAmostra === voz.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : tocandoAmostra === voz.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{tocandoAmostra === voz.id ? "Parar" : "Ouvir exemplo"}</button><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${voz.padrao ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{voz.padrao ? "Padrão" : "Opcional"}</span></div>)}{!config.vozes.length && <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Nenhuma voz configurada no servidor.</p>}</div></section>
      <section className="hub-card rounded-2xl p-5"><Gauge className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Limites de vídeo</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tamanho máximo</dt><dd className="font-medium">{Math.round(config.limiteBytes / 1024 / 1024)} MB</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Duração máxima</dt><dd className="font-medium">{Math.round(config.limiteDuracaoMs / 60000)} minutos</dd></div></dl></section>
      <section className="hub-card rounded-2xl p-5"><Captions className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Geração padrão</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Modelo</dt><dd className="font-medium">{config.modeloPadrao}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Legendas</dt><dd className="font-medium">Ativadas</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ajuste de texto</dt><dd className="font-medium">Automático</dd></div></dl></section>
      <section className="hub-card rounded-2xl p-5"><Database className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Armazenamento</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">{config.retencao}</p></section>
    </div>}
  </div>;
}
