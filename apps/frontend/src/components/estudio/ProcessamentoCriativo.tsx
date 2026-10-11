import { useEffect, useRef, useState } from "react";
import { Gamepad2, Sparkles, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { listarRecordes, registrarRecorde, type ProcessamentoEstudio, type RecordeCobrinha } from "@/lib/estudio-api";
import { avancarPercentualVisual, limiteVisualDoFluxo } from "@/lib/progresso-processamento";
import { alturaCobrinha, larguraCobrinha, moverCobrinha, novaComida, type Direcao } from "./cobrinha";

const oposta: Record<Direcao, Direcao> = { cima: "baixo", baixo: "cima", esquerda: "direita", direita: "esquerda" };
const frases: Record<string, string[]> = {
  processando_video: ["Conferindo a qualidade do vídeo", "Preparando as cenas", "Organizando seu material com segurança"],
  recebido: ["Colocando seu vídeo na fila", "Preparando o ambiente de criação", "Tudo certo para começar"],
  analisando: ["Entendendo cada ação da gravação", "Escrevendo uma explicação clara e natural", "Ajustando o ritmo entre as cenas", "Revisando os tempos do roteiro"],
  gerando_voz: ["Transformando o roteiro em uma narração natural", "Sincronizando a voz com cada ação", "Medindo o ritmo de todas as cenas"],
  validando_duracoes: ["Evitando falas apertadas ou pausas longas", "Ajustando o texto ao tempo disponível", "Conferindo a fluidez da narração"],
  renderizando: ["Unindo vídeo, voz e legendas", "Dando acabamento ao seu tutorial", "Seu vídeo está quase pronto"],
  verificando_resultado: ["Fazendo a última conferência", "Validando áudio e imagem", "Preparando o arquivo para download"]
};

function Cobrinha({ token, nicknameInicial, aoFechar }: { token: string; nicknameInicial: string; aoFechar: () => void }) {
  const inicial = [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
  const [jogo, setJogo] = useState({ corpo: inicial, comida: { x: 11, y: 6 }, pontos: 0, perdeu: false });
  const [registro, setRegistro] = useState(false);
  const [segundos, setSegundos] = useState(20);
  const [nickname, setNickname] = useState(nicknameInicial.slice(0, 10));
  const [recordes, setRecordes] = useState<RecordeCobrinha[]>([]);
  const [erro, setErro] = useState("");
  const direcao = useRef<Direcao>("direita");
  const area = useRef<HTMLDivElement>(null);

  function mudar(nova: Direcao) {
    if (!registro && oposta[direcao.current] !== nova) direcao.current = nova;
    area.current?.focus();
  }

  function pedirRegistro() {
    setRegistro(true); setSegundos(20);
  }

  useEffect(() => { void listarRecordes(token).then(setRecordes).catch(() => undefined); }, [token]);
  useEffect(() => {
    if (!registro) return;
    const timer = window.setInterval(() => setSegundos((atual) => atual - 1), 1000);
    return () => window.clearInterval(timer);
  }, [registro]);
  useEffect(() => { if (registro && segundos <= 0) aoFechar(); }, [registro, segundos, aoFechar]);
  useEffect(() => {
    area.current?.focus();
    const timer = window.setInterval(() => setJogo((atual) => {
      if (atual.perdeu || registro) return atual;
      const proximo = moverCobrinha(atual.corpo, direcao.current, atual.comida);
      if (proximo.colidiu) queueMicrotask(pedirRegistro);
      return { corpo: proximo.corpo, comida: proximo.comeu ? novaComida(proximo.corpo) : atual.comida, pontos: atual.pontos + (proximo.comeu ? 100 : 0), perdeu: proximo.colidiu };
    }), 135);
    return () => window.clearInterval(timer);
  }, [registro]);

  async function salvar() {
    if (!nickname.trim()) { setErro("Digite um nickname."); return; }
    try { await registrarRecorde(token, nickname.trim(), jogo.pontos); aoFechar(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível registrar."); }
  }

  return <div className="w-full"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Cobrinha · {jogo.pontos.toLocaleString("pt-BR")}</p><Button size="icon" variant="ghost" aria-label="Fechar cobrinha" onClick={pedirRegistro}><X className="h-4 w-4" /></Button></div>
    <div ref={area} tabIndex={0} aria-label="Jogo da cobrinha" onKeyDown={(event) => { const mapa: Record<string, Direcao | undefined> = { ArrowUp: "cima", w: "cima", ArrowDown: "baixo", s: "baixo", ArrowLeft: "esquerda", a: "esquerda", ArrowRight: "direita", d: "direita" }; const nova = mapa[event.key]; if (nova) { event.preventDefault(); mudar(nova); } }} className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-slate-950 outline-none ring-primary focus:ring-2">
      {jogo.corpo.map((ponto, indice) => <span key={`${ponto.x}-${ponto.y}-${indice}`} className={`absolute rounded-sm ${indice ? "bg-cyan-400" : "bg-white"}`} style={{ left: `${ponto.x / larguraCobrinha * 100}%`, top: `${ponto.y / alturaCobrinha * 100}%`, width: `${100 / larguraCobrinha}%`, height: `${100 / alturaCobrinha}%` }} />)}
      <span className="absolute rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24]" style={{ left: `${jogo.comida.x / larguraCobrinha * 100}%`, top: `${jogo.comida.y / alturaCobrinha * 100}%`, width: `${100 / larguraCobrinha}%`, height: `${100 / alturaCobrinha}%` }} />
      {registro && <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-5 text-center text-white"><p className="text-xs uppercase tracking-widest text-cyan-300">Fim de jogo</p><h4 className="mt-1 text-xl font-semibold">Registrar {jogo.pontos.toLocaleString("pt-BR")} pontos?</h4><label className="mt-4 w-full max-w-56 text-left text-xs">Nickname · até 10 caracteres<input autoFocus maxLength={10} value={nickname} onChange={(event) => setNickname(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm uppercase outline-none focus:border-cyan-300" /></label>{erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}<div className="mt-3 flex gap-2"><Button className="bg-white text-slate-950 hover:bg-white/90" onClick={() => { void salvar(); }}>Registrar</Button><Button variant="ghost" className="text-white" onClick={aoFechar}>Deixar para lá</Button></div><progress aria-label="Tempo para registrar recorde" max={20} value={segundos} className="mt-4 h-2 w-full max-w-56 accent-cyan-300" /><p className="mt-1 text-xs text-white/60">{segundos}s para confirmar</p></div>}
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden"><span /><Button variant="outline" onClick={() => mudar("cima")}>↑</Button><span /><Button variant="outline" onClick={() => mudar("esquerda")}>←</Button><Button variant="outline" onClick={() => mudar("baixo")}>↓</Button><Button variant="outline" onClick={() => mudar("direita")}>→</Button></div>
    <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Top 10</p>{recordes.length ? <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">{recordes.map((recorde, indice) => <li key={`${recorde.nickname}-${indice}`} className="flex justify-between gap-2"><span>{indice + 1}. {recorde.nickname}</span><strong>{recorde.score.toLocaleString("pt-BR")}</strong></li>)}</ol> : <p className="mt-2 text-xs text-white/50">Seja o primeiro recordista.</p>}</div>
    <p className="mt-2 text-center text-xs text-muted-foreground">Use as setas ou WASD. Cada comida vale 100 pontos; as bordas levam ao lado oposto.</p>
  </div>;
}

export function ProcessamentoCriativo({ token, nickname, processamento, percentual, aoCancelar }: { token: string; nickname: string; processamento: ProcessamentoEstudio; percentual: number; aoCancelar: () => void }) {
  const [indice, setIndice] = useState(0);
  const [jogando, setJogando] = useState(false);
  const [percentualVisual, setPercentualVisual] = useState(percentual);
  const mensagens = frases[processamento.status] ?? ["Preparando seu tutorial", "Trabalhando nos próximos detalhes", "Acompanhando cada etapa para você"];
  const limiteVisual = limiteVisualDoFluxo(processamento);

  useEffect(() => {
    const timer = window.setInterval(() => setIndice((atual) => (atual + 1) % mensagens.length), 2600);
    return () => window.clearInterval(timer);
  }, [mensagens.length]);

  useEffect(() => {
    const timer = window.setInterval(() => setPercentualVisual((atual) => avancarPercentualVisual(atual, percentual, limiteVisual)), 80);
    return () => window.clearInterval(timer);
  }, [limiteVisual, percentual]);

  const percentualExibido = percentualVisual >= 100 ? "100" : percentualVisual.toFixed(2);

  return <section className="hub-card overflow-hidden rounded-2xl"><div className={`grid min-h-[420px] ${jogando ? "lg:grid-cols-[minmax(280px,0.65fr)_minmax(0,1.35fr)]" : "lg:grid-cols-2"}`}>
    <div className="flex flex-col justify-center p-6 sm:p-10"><p className="eyebrow">Seu tutorial está sendo preparado</p><h2 className="mt-2 text-2xl font-semibold">Pode deixar com a gente.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Você pode continuar nesta página ou voltar mais tarde. O trabalho não será perdido.</p>
      <div className="mt-8"><div className="flex items-end justify-between gap-3"><p role="status" aria-live="polite" className="text-sm font-medium">{processamento.mensagem ?? "Processando…"}</p><strong className="text-2xl tabular-nums text-primary">{percentualExibido}%</strong></div><progress aria-label="Progresso da criação do tutorial" className="mt-3 h-3 w-full accent-primary" max={100} value={percentualVisual} /><p key={`${processamento.status}-${indice}`} className="status-fade mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" />{mensagens[indice % mensagens.length]}</p></div>
      <Button variant="ghost" className="mt-8 self-start" onClick={aoCancelar}>Cancelar processamento</Button>
    </div>
    <div className={`flex min-h-[360px] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white ${jogando ? "p-4 sm:p-5" : "p-6 sm:p-10"}`}>{jogando ? <Cobrinha token={token} nicknameInicial={nickname} aoFechar={() => setJogando(false)} /> : <div className="text-center"><div className="relative mx-auto grid h-48 w-48 place-items-center"><span className="absolute inset-0 animate-spin rounded-full border border-cyan-300/20 border-t-cyan-300" /><span className="absolute inset-5 animate-[spin_7s_linear_infinite_reverse] rounded-full border border-dashed border-cyan-200/30" /><span className="absolute inset-12 animate-pulse rounded-full bg-cyan-300/10 blur-xl" /><WandSparkles className="relative h-14 w-14 text-cyan-200" /></div><h3 className="mt-5 text-lg font-semibold">Transforme a espera em diversão</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/60">Seu vídeo fica pronto enquanto você tenta entrar no ranking.</p><Button className="mt-5 bg-white text-slate-950 hover:bg-white/90" onClick={() => setJogando(true)}><Gamepad2 className="h-4 w-4" />Quero bater meu recorde</Button></div>}</div>
  </div></section>;
}
