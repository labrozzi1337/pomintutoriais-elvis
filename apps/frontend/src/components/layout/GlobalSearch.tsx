import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Building2, CornerDownLeft, FileVideo, LayoutGrid, Loader2, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth";
import { buscarGlobalmente, type ItemBuscaGlobal } from "@/lib/busca-global";
import { listarOrganizacao, listarProjetos, listarWiki } from "@/lib/estudio-api";

const paginas: ItemBuscaGlobal[] = [
  { id: "pagina-dashboard", titulo: "Visão geral", descricao: "Resumo do estúdio", termos: ["dashboard", "início"], destino: "/dashboard", categoria: "Página" },
  { id: "pagina-biblioteca", titulo: "Biblioteca", descricao: "Todos os vídeos e tutoriais", termos: ["acervo", "projetos"], destino: "/tutoriais", categoria: "Página" },
  { id: "pagina-criar", titulo: "Criar vídeo", descricao: "Enviar e produzir um tutorial", termos: ["upload", "gravar"], destino: "/criar", categoria: "Página" },
  { id: "pagina-organizacao", titulo: "Organização", descricao: "Empresas e áreas", termos: ["setores"], destino: "/organizacao", categoria: "Página" },
  { id: "pagina-wiki", titulo: "Wiki", descricao: "Artigos dos tutoriais", termos: ["documentação"], destino: "/wiki", categoria: "Página" },
  { id: "pagina-configuracoes", titulo: "Configurações", descricao: "Padrões do estúdio", termos: ["voz", "limites"], destino: "/configuracoes", categoria: "Página" }
];

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { session, tipo } = useAuth();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [consulta, setConsulta] = useState("");
  const [itens, setItens] = useState<ItemBuscaGlobal[]>(paginas);
  const [carregando, setCarregando] = useState(false);
  const resultados = useMemo(() => buscarGlobalmente(itens, consulta), [consulta, itens]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => input.current?.focus());
    const token = session?.access_token;
    if (!token) return;
    let ativo = true;
    queueMicrotask(() => { if (ativo) setCarregando(true); });
    void Promise.all([listarProjetos(token), listarOrganizacao(token), listarWiki(token)]).then(([projetos, empresas, artigos]) => {
      if (!ativo) return;
      const dinamicos: ItemBuscaGlobal[] = [
        ...projetos.map((projeto) => ({ id: `projeto-${projeto.id}`, titulo: projeto.titulo, descricao: `${projeto.empresa} · ${projeto.setor}`, termos: [projeto.descricao, ...projeto.tags, ...projeto.videos.map((video) => video.nome_original)], destino: `/criar?projeto=${projeto.id}`, categoria: "Tutorial" })),
        ...artigos.map((artigo) => ({ id: `wiki-${artigo.id}`, titulo: artigo.titulo, descricao: `${artigo.empresa} · ${artigo.area}`, termos: [artigo.resumo, artigo.conteudo, ...artigo.topicos.map((topico) => topico.titulo)], destino: `/wiki?projeto=${artigo.projetoId}`, categoria: "Wiki" })),
        ...empresas.flatMap((empresa) => [{ id: `empresa-${empresa.id}`, titulo: empresa.nome, descricao: "Empresa", termos: empresa.areas.map((area) => area.nome), destino: "/organizacao", categoria: "Organização" }, ...empresa.areas.map((area) => ({ id: `area-${area.id}`, titulo: area.nome, descricao: empresa.nome, termos: ["área", "setor"], destino: "/organizacao", categoria: "Organização" }))])
      ];
      setItens([...paginas, ...(tipo === "admin" ? [{ id: "pagina-usuarios", titulo: "Usuários", descricao: "Controle de acessos", termos: ["permissões", "administradores"], destino: "/usuarios", categoria: "Página" }] : []), ...dinamicos]);
    }).catch(() => undefined).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [open, session?.access_token, tipo]);

  function abrir(item: ItemBuscaGlobal) { onOpenChange(false); void navigate(item.destino); }
  if (!open) return null;

  return <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/50 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onOpenChange(false); }}>
    <section role="dialog" aria-modal="true" aria-label="Busca global" className="w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-2xl" onKeyDown={(event) => { if (event.key === "Escape") onOpenChange(false); if (event.key === "Enter" && resultados[0]) abrir(resultados[0]); }}>
      <div className="flex items-center gap-3 border-b px-4"><Search className="h-5 w-5 text-primary" /><input ref={input} value={consulta} onChange={(event) => setConsulta(event.target.value)} placeholder="Buscar páginas, tutoriais, empresas, áreas ou artigos…" className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /><kbd className="rounded border bg-muted px-2 py-1 text-[10px] text-muted-foreground">Ctrl Q</kbd><button type="button" aria-label="Fechar busca" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /></button></div>
      <div className="max-h-[55vh] overflow-y-auto p-2">{carregando && <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Atualizando resultados…</p>}{resultados.map((item) => <button key={item.id} type="button" onClick={() => abrir(item)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-muted"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">{item.categoria === "Tutorial" ? <FileVideo className="h-4 w-4" /> : item.categoria === "Wiki" ? <BookOpen className="h-4 w-4" /> : item.categoria === "Organização" ? <Building2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.titulo}</strong><span className="block truncate text-xs text-muted-foreground">{item.categoria} · {item.descricao}</span></span><CornerDownLeft className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-50" /></button>)}{!resultados.length && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</p>}</div>
    </section>
  </div>;
}
