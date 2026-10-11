import { Download, MonitorUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function IntegracaoWindows({ aoAbrir }: { aoAbrir: () => void }) {
  const [mostrarDownload, setMostrarDownload] = useState(false);
  const verificacao = useRef<number | undefined>(undefined);
  const tentandoAbrir = useRef(false);

  useEffect(() => {
    function abriuAplicativo() {
      if (!tentandoAbrir.current) return;
      tentandoAbrir.current = false;
      window.clearTimeout(verificacao.current);
      setMostrarDownload(false);
      aoAbrir();
    }
    window.addEventListener("blur", abriuAplicativo);
    document.addEventListener("visibilitychange", abriuAplicativo);
    return () => {
      window.clearTimeout(verificacao.current);
      window.removeEventListener("blur", abriuAplicativo);
      document.removeEventListener("visibilitychange", abriuAplicativo);
    };
  }, [aoAbrir]);

  function abrirRecordly() {
    setMostrarDownload(false);
    tentandoAbrir.current = true;
    window.clearTimeout(verificacao.current);
    verificacao.current = window.setTimeout(() => setMostrarDownload(true), 1800);
    if (!/Windows/i.test(navigator.userAgent)) return;
    window.location.assign("estudiotutoriais://abrir");
  }

  return <div className="rounded-xl border p-4">
    <h3 className="font-medium">Gravar com Recordly</h3>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">O Recordly é obrigatório: abra-o, grave e edite a tela, exporte em MP4 e volte para importar o arquivo acima.</p>
    <Button className="mt-3" variant="outline" onClick={abrirRecordly}><MonitorUp className="h-4 w-4" />Abrir Recordly</Button>
    {mostrarDownload && <div className="mt-3" role="status">
      <p className="text-xs text-muted-foreground">O Recordly não foi encontrado nesta máquina.</p>
      <a className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted" href="https://github.com/webadderallorg/Recordly/releases" target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Baixar Recordly</a>
    </div>}
  </div>;
}
