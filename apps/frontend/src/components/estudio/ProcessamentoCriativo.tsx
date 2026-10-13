import { useEffect, useState } from "react";
import { Check, FileVideo2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProcessamentoEstudio } from "@/lib/estudio-api";
import { avancarPercentualVisual, limiteVisualDoFluxo } from "@/lib/progresso-processamento";

const frases = [
  "O Pomin 360 conecta diferentes aplicações em um único ecossistema.",
  "O Grupo Pomin reúne mais de 400 pessoas construindo soluções todos os dias.",
  "Tudo começou com a Solutta. Hoje, o ecossistema vai muito além da contabilidade.",
  "Quando as aplicações conversam, o trabalho flui melhor.",
  "Tecnologia boa é aquela que reduz etapas, não aquela que cria novas.",
  "O Pomin SAC centraliza solicitações para que nenhuma demanda importante se perca.",
  "O Pomin 360 conecta pessoas, dados, processos e decisões.",
  "A inovação por aqui não fica na apresentação. Ela vira aplicação.",
  "Grandes resultados começam com processos bem conectados.",
  "O futuro do Grupo Pomin não está sendo esperado. Está sendo construído."
];

const etapas: Record<string, string> = {
  processando_video: "Conferindo a qualidade do vídeo e preparando as cenas.", recebido: "Colocando seu vídeo na fila de criação.",
  analisando: "Entendendo as ações e escrevendo uma explicação clara.", gerando_voz: "Transformando o roteiro em uma narração natural.",
  validando_duracoes: "Ajustando o texto ao tempo de cada cena.", renderizando: "Unindo vídeo, voz e legendas.",
  verificando_resultado: "Fazendo a última conferência de áudio e imagem."
};

export function ProcessamentoCriativo({ processamento, percentual, finalizado, aoCancelar }: { processamento: ProcessamentoEstudio; percentual: number; finalizado: boolean; aoCancelar: () => void }) {
  const [indice, setIndice] = useState(0);
  const [percentualVisual, setPercentualVisual] = useState(percentual);
  const limiteVisual = limiteVisualDoFluxo(processamento);

  useEffect(() => { const timer = window.setInterval(() => setIndice((atual) => (atual + 1) % frases.length), 6500); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const timer = window.setInterval(() => setPercentualVisual((atual) => avancarPercentualVisual(atual, percentual, limiteVisual)), 80); return () => window.clearInterval(timer); }, [limiteVisual, percentual]);
  const exibido = finalizado ? 100 : Math.min(99.99, percentualVisual);

  return <section role="status" aria-live="polite" className="relative min-h-[580px] overflow-hidden rounded-2xl border bg-[#f5f9fc] text-[#11283d] shadow-sm">
    <div className="absolute inset-0 bg-[linear-gradient(rgba(19,89,145,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(19,89,145,0.05)_1px,transparent_1px)] bg-[size:44px_44px]" />
    <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-sky-300/35 blur-3xl" /><div className="absolute -bottom-20 right-[5%] h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl" />
    <div className="relative flex min-h-[580px] flex-col p-5 sm:p-8 lg:p-10"><header className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Estúdio de Tutoriais</p><p className="mt-1 text-sm font-semibold">Grupo Pomin · Pomin 360</p></div><span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" />{finalizado ? "Concluído" : "Processamento seguro"}</span></header>
      <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-14"><div className="hidden items-center justify-center sm:flex"><div className="relative grid h-56 w-56 place-items-center lg:h-72 lg:w-72"><span className="absolute inset-0 animate-[spin_18s_linear_infinite] rounded-full border border-primary/20"><span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_0_8px_rgba(251,191,36,0.13)]" /></span><span className="absolute inset-7 animate-[spin_24s_linear_infinite_reverse] rounded-[42%] border-2 border-dashed border-emerald-400/35" /><span className="absolute inset-14 rounded-full bg-gradient-to-br from-primary via-sky-500 to-emerald-400 shadow-[0_32px_80px_-24px_rgba(19,89,145,0.65)]" /><span className="relative grid h-24 w-24 place-items-center rounded-3xl border border-white/35 bg-white/20 text-white backdrop-blur">{finalizado ? <Check className="h-11 w-11" /> : <FileVideo2 className="h-11 w-11" />}<Sparkles className="absolute -right-3 -top-3 h-9 w-9 animate-bounce rounded-full bg-white p-2 text-amber-500 shadow-lg" /></span></div></div>
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{finalizado ? "100% concluído" : processamento.mensagem ?? "Criando seu tutorial"}</p><h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">{finalizado ? "Tudo pronto para continuar." : etapas[processamento.status] ?? "Seu tutorial está sendo preparado com cuidado."}</h2><div className="relative mt-7 overflow-hidden rounded-2xl border border-white bg-white/85 p-6 shadow-[0_28px_80px_-40px_rgba(17,40,61,0.35)] backdrop-blur sm:p-8"><span className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary via-sky-400 to-emerald-400" /><span className="absolute right-5 top-0 font-serif text-8xl leading-none text-amber-400/20">“</span><p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Enquanto isso no Pomin 360</p><p className="relative text-xl font-semibold leading-snug sm:text-2xl">{frases[indice]}</p></div>{!finalizado && <Button variant="ghost" className="mt-5 text-[#29465f]" onClick={aoCancelar}>Cancelar processamento</Button>}</div></main>
      <footer className="rounded-xl border border-primary/10 bg-white/85 p-4 shadow-sm backdrop-blur"><div className="mb-2 flex items-center justify-between gap-4"><span className="text-xs font-semibold text-[#29465f]">{finalizado ? "Finalizado" : "Progresso real da criação do vídeo"}</span><span className="font-mono text-xs font-bold text-primary">{exibido.toFixed(exibido === 100 ? 0 : 2)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="relative h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-emerald-400 transition-[width] duration-700" style={{ width: `${exibido}%` }}><span className="absolute inset-y-0 right-0 w-16 animate-pulse bg-gradient-to-r from-transparent to-white/70" /></div></div></footer>
    </div>
  </section>;
}
