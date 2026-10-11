import { useEffect, useState, type FormEvent } from "react";
import { Building2, Folder, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { criarArea, criarEmpresa, listarOrganizacao, listarProjetos, moverProjeto, type EmpresaEstudio, type ProjetoEstudio } from "@/lib/estudio-api";

const campo = "w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function OrganizationPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [empresas, setEmpresas] = useState<EmpresaEstudio[]>([]);
  const [projetos, setProjetos] = useState<ProjetoEstudio[]>([]);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nomeArea, setNomeArea] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [arrastando, setArrastando] = useState("");
  const [erro, setErro] = useState("");

  async function carregar() {
    const [organizacao, lista] = await Promise.all([listarOrganizacao(token), listarProjetos(token)]);
    setEmpresas(organizacao); setProjetos(lista);
  }

  useEffect(() => {
    void Promise.all([listarOrganizacao(token), listarProjetos(token)])
      .then(([organizacao, lista]) => { setEmpresas(organizacao); setProjetos(lista); })
      .catch((error: unknown) => setErro(error instanceof Error ? error.message : "Falha ao carregar."));
  }, [token]);

  async function executar(fn: () => Promise<void>) {
    setErro("");
    try { await fn(); await carregar(); } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível concluir."); }
  }

  function cadastrarEmpresa(event: FormEvent) {
    event.preventDefault();
    void executar(async () => {
      const nome = nomeEmpresa.trim();
      if (!nome) throw new Error("Digite o nome da empresa.");
      if (empresas.some((empresa) => empresa.nome.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Esta empresa já está cadastrada.");
      await criarEmpresa(token, nome); setNomeEmpresa("");
    });
  }

  function cadastrarArea(event: FormEvent) {
    event.preventDefault();
    void executar(async () => {
      const nome = nomeArea.trim();
      const empresa = empresas.find((item) => item.id === empresaId);
      if (!empresa) throw new Error("Selecione a empresa.");
      if (!nome) throw new Error("Digite o nome da área.");
      if (empresa.areas.some((area) => area.nome.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Esta área já está cadastrada.");
      await criarArea(token, empresaId, nome); setNomeArea("");
    });
  }

  const areas = empresas.flatMap((empresa) => empresa.areas.map((area) => ({ ...area, empresa: empresa.nome })));

  return <div className="mx-auto min-h-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="eyebrow">Organização</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Empresas, áreas e arquivos</h1><p className="mt-2 text-sm text-muted-foreground">Cadastre a estrutura antes da produção. Depois, arraste cada vídeo para a área correta.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
    <section className="grid gap-4 lg:grid-cols-2"><form onSubmit={cadastrarEmpresa} className="hub-card rounded-2xl p-5"><Building2 className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">1. Criar empresa</h2><p className="mt-1 text-xs text-muted-foreground">Use o nome oficial uma única vez.</p><div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="nova-empresa">Nome da empresa</label><input id="nova-empresa" required maxLength={120} className={campo} value={nomeEmpresa} onChange={(event) => setNomeEmpresa(event.target.value)} placeholder="Nome da empresa" /><Button type="submit">Criar</Button></div></form>
      <form onSubmit={cadastrarArea} className="hub-card rounded-2xl p-5"><Folder className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">2. Criar área</h2><p className="mt-1 text-xs text-muted-foreground">Toda área pertence a uma empresa.</p><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="sr-only" htmlFor="empresa-da-area">Empresa</label><select id="empresa-da-area" required className={campo} value={empresaId} onChange={(event) => setEmpresaId(event.target.value)}><option value="">Selecione a empresa</option>{empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}</select><label className="sr-only" htmlFor="nova-area">Nome da área</label><input id="nova-area" required maxLength={120} className={campo} value={nomeArea} onChange={(event) => setNomeArea(event.target.value)} placeholder="Nome da área" /><Button type="submit">Criar</Button></div></form></section>
    <section className="grid gap-4 xl:grid-cols-[360px_1fr]"><div className="hub-card rounded-2xl p-5"><h2 className="font-semibold">3. Vídeos para organizar</h2><p className="mt-1 text-xs text-muted-foreground">Arraste um item ou escolha o destino no seletor.</p><div className="mt-4 space-y-2">{projetos.map((projeto) => <article key={projeto.id} draggable onDragStart={() => setArrastando(projeto.id)} onDragEnd={() => setArrastando("")} className="rounded-xl border bg-background p-3"><div className="flex items-center gap-2"><GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-medium">{projeto.titulo}</p><p className="truncate text-xs text-muted-foreground">{projeto.empresa} › {projeto.setor}</p></div></div><select aria-label={`Mover ${projeto.titulo}`} className={`${campo} mt-3`} value="" onChange={(event) => { if (event.target.value) void executar(() => moverProjeto(token, projeto.id, event.target.value)); }}><option value="">Mover para…</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.empresa} › {area.nome}</option>)}</select></article>)}</div></div>
      <div><h2 className="font-semibold">Estrutura atual</h2><p className="mt-1 text-xs text-muted-foreground">Solte o vídeo sobre a área de destino.</p><div className="mt-4 grid gap-4 md:grid-cols-2">{empresas.map((empresa) => <section key={empresa.id} className="rounded-2xl border p-4"><h3 className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-primary" />{empresa.nome}</h3><div className="mt-3 space-y-2">{empresa.areas.map((area) => { const itens = projetos.filter((projeto) => projeto.empresa === empresa.nome && projeto.setor === area.nome); return <div key={area.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (arrastando) void executar(() => moverProjeto(token, arrastando, area.id)); setArrastando(""); }} className={`min-h-28 rounded-xl border border-dashed p-3 transition-colors ${arrastando ? "border-primary bg-primary/5" : ""}`}><p className="flex items-center gap-2 text-sm font-medium"><Folder className="h-4 w-4" />{area.nome}<span className="ml-auto text-xs text-muted-foreground">{itens.length}</span></p>{itens.map((item) => <p key={item.id} className="mt-2 truncate rounded-lg bg-muted px-3 py-2 text-xs">{item.titulo}</p>)}</div>; })}{!empresa.areas.length && <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Crie a primeira área acima.</p>}</div></section>)}</div></div></section>
  </div>;
}
