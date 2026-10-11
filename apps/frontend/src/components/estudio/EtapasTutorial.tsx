const etapas = ["Vídeo", "Roteiro", "Voz"];

export function EtapasTutorial({ atual }: { atual: 1 | 2 | 3 }) {
  return <ol aria-label="Etapas do tutorial" className="grid grid-cols-3 gap-2">
    {etapas.map((nome, indice) => {
      const numero = indice + 1;
      const concluida = numero < atual;
      const ativa = numero === atual;
      return <li key={nome} aria-current={ativa ? "step" : undefined} className={`rounded-xl border p-3 ${ativa ? "border-primary bg-primary/10" : ""}`}>
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${concluida || ativa ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{concluida ? "✓" : numero}</span>
          <span className={`text-xs font-medium sm:text-sm ${ativa ? "text-foreground" : "text-muted-foreground"}`}>{nome}</span>
        </div>
      </li>;
    })}
  </ol>;
}
