import { AlertTriangle, Download, MonitorUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { detectarSistemaRecordly, downloadsRecordly, urlAberturaRecordly } from "@/lib/recordly";

const linkDownload = "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function IntegracaoWindows({ aoAbrir }: { aoAbrir: () => void }) {
  const [mostrarDownload, setMostrarDownload] = useState(false);
  const [todosSistemas, setTodosSistemas] = useState(false);
  const verificacao = useRef<number>();
  const tentandoAbrir = useRef(false);
  const sistema = detectarSistemaRecordly(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);

  useEffect(() => {
    function aplicativoRespondeu() {
      if (!tentandoAbrir.current) return;
      tentandoAbrir.current = false;
      window.clearTimeout(verificacao.current);
      setMostrarDownload(false);
    }
    window.addEventListener("blur", aplicativoRespondeu);
    document.addEventListener("visibilitychange", aplicativoRespondeu);
    return () => {
      window.clearTimeout(verificacao.current);
      window.removeEventListener("blur", aplicativoRespondeu);
      document.removeEventListener("visibilitychange", aplicativoRespondeu);
    };
  }, []);

  function abrirRecordly() {
    setMostrarDownload(false);
    tentandoAbrir.current = true;
    window.clearTimeout(verificacao.current);
    verificacao.current = window.setTimeout(() => { tentandoAbrir.current = false; setMostrarDownload(true); }, 2500);
    window.location.assign(urlAberturaRecordly);
  }

  return <div className="space-y-3 rounded-xl border p-4">
    <h3 className="font-medium">Gravar com Recordly</h3>
    <p className="text-xs leading-6 text-muted-foreground">Abra o Recordly, grave e edite a tela, exporte em MP4 e volte para importar o arquivo.</p>
    <Button variant="outline" onClick={abrirRecordly}><MonitorUp className="h-4 w-4" />{mostrarDownload ? "Tentar abrir Recordly novamente" : "Abrir Recordly"}</Button>
    {mostrarDownload && <div role="status" aria-live="polite" className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" /><div><p className="font-semibold">O Recordly não abriu?</p><p className="mt-1 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Se você já instalou, está tudo bem:</strong> abra o Recordly pelo menu Iniciar e comece a gravação. Quando terminar, exporte o vídeo em MP4 e faça o upload aqui.</p></div></div>
      {sistema === "windows" && <div className="rounded-md border bg-background/70 p-3"><p className="text-xs font-medium">Local padrão no Windows</p><code className="mt-1 block break-all text-xs text-muted-foreground">%LOCALAPPDATA%\Programs\Recordly\Recordly.exe</code></div>}
      <div className="border-t border-amber-500/30 pt-3"><p className="mb-2 text-sm font-medium">Ainda não instalou? Baixe a versão do seu sistema:</p>
      {(sistema === "windows" || sistema === "desconhecido" || todosSistemas) && <DownloadRecordly sistema="windows" />}
      {(sistema === "macos" || sistema === "desconhecido" || todosSistemas) && <DownloadRecordly sistema="macos" />}
      {(sistema === "linux" || sistema === "desconhecido" || todosSistemas) && <DownloadRecordly sistema="linux" />}
      {sistema !== "desconhecido" && <Button variant="ghost" aria-expanded={todosSistemas} onClick={() => setTodosSistemas(!todosSistemas)}>{todosSistemas ? "Mostrar apenas meu sistema" : "Downloads para outros sistemas"}</Button>}
      </div>
    </div>}
    <Button onClick={aoAbrir}>Já exportei o MP4 · importar vídeo</Button>
  </div>;
}

function DownloadRecordly({ sistema }: { sistema: keyof typeof downloadsRecordly }) {
  const links = downloadsRecordly[sistema].map(({ nome, url }) => <a key={url} className={linkDownload} href={url}><Download className="h-4 w-4 shrink-0" />{nome}</a>);
  return sistema === "macos" ? <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium">Baixar para macOS · escolher processador e formato</summary><p className="my-2 text-xs text-muted-foreground">Veja o processador no menu Apple → Sobre Este Mac. Escolha DMG para instalar ou ZIP como alternativa.</p><div className="flex flex-col items-start gap-2">{links}</div></details> : <div>{links}</div>;
}
