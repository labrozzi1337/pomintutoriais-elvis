import { useEffect, useState, type FormEvent } from "react";
import { Building2, Captions, Database, Gauge, KeyRound, Mic2, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { alterarTipoUsuario, criarUsuario, excluirUsuario, listarUsuarios, obterConfiguracoes, type ConfiguracoesEstudio, type ControleUsuarios } from "@/lib/estudio-api";

const campo = "mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buscarConfiguracoes = (token: string) => Promise.all([obterConfiguracoes(token), listarUsuarios(token)]);

export function SettingsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [config, setConfig] = useState<ConfiguracoesEstudio | null>(null);
  const [controle, setControle] = useState<ControleUsuarios | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [metodo, setMetodo] = useState<"local" | "microsoft">("local");
  const [tipo, setTipo] = useState<"comum" | "admin">("comum");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    let ativo = true;
    void buscarConfiguracoes(token).then(([configuracoes, usuarios]) => { if (ativo) { setConfig(configuracoes); setControle(usuarios); } }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível carregar as configurações."); });
    return () => { ativo = false; };
  }, [token]);

  async function recarregarUsuarios() { setControle(await listarUsuarios(token)); }

  async function criar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErro(""); setSucesso(""); setSalvando(true);
    try {
      await criarUsuario(token, { email: email.trim(), nome: nome.trim() || undefined, tipo, metodo, ...(metodo === "local" ? { senha } : {}) });
      setNome(""); setEmail(""); setSenha(""); setTipo("comum");
      setSucesso(metodo === "local" ? "Conta criada. O usuário já pode entrar com e-mail e senha." : "E-mail liberado. No primeiro SSO, a conta Microsoft será vinculada automaticamente.");
      await recarregarUsuarios();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível criar o usuário."); }
    finally { setSalvando(false); }
  }

  async function remover(usuarioId: string, usuarioEmail: string) {
    if (!window.confirm(`Excluir o acesso de ${usuarioEmail}? Esta ação não pode ser desfeita.`)) return;
    setErro(""); setSucesso("");
    try { await excluirUsuario(token, usuarioId); setSucesso("Usuário excluído."); await recarregarUsuarios(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível excluir o usuário."); }
  }

  async function alterarTipo(usuarioId: string, novoTipo: "comum" | "admin") {
    setErro(""); setSucesso("");
    try { await alterarTipoUsuario(token, usuarioId, novoTipo); setSucesso("Permissão atualizada."); await recarregarUsuarios(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível atualizar a permissão."); }
  }

  return <div className="mx-auto min-h-full max-w-[1100px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="eyebrow">Configurações</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Padrões e acessos</h1><p className="mt-2 text-sm text-muted-foreground">Usuários comuns trabalham em todo o acervo. Administradores também podem excluir registros e controlar acessos.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}{sucesso && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{sucesso}</p>}
    {!config || !controle ? !erro && <p className="text-sm text-muted-foreground">Carregando configurações…</p> : <>
      <section className="hub-card rounded-2xl p-5"><Users className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Usuários e formas de acesso</h2><p className="mt-1 text-sm text-muted-foreground">O acesso só é liberado para e-mails cadastrados aqui, inclusive no Microsoft SSO.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><Building2 className="h-5 w-5" /><strong className="mt-2 block text-sm">Microsoft SSO</strong><span className="mt-1 block text-xs text-muted-foreground">O administrador libera o e-mail; a identidade é vinculada no primeiro login.</span></div><div className="rounded-xl border p-4"><KeyRound className="h-5 w-5" /><strong className="mt-2 block text-sm">Conta local</strong><span className="mt-1 block text-xs text-muted-foreground">O administrador cria o e-mail e uma senha inicial.</span></div></div>
        {controle.administrador ? <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]"><form onSubmit={(event) => { void criar(event); }} className="rounded-xl border p-4"><div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Liberar novo usuário</h3></div>
          <fieldset className="mt-4"><legend className="text-xs font-medium">Forma de entrada</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" aria-pressed={metodo === "local"} onClick={() => setMetodo("local")} className={`rounded-lg border p-3 text-left text-xs ${metodo === "local" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><strong className="block">E-mail e senha</strong><span className="text-muted-foreground">Conta local</span></button><button type="button" aria-pressed={metodo === "microsoft"} onClick={() => setMetodo("microsoft")} className={`rounded-lg border p-3 text-left text-xs ${metodo === "microsoft" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><strong className="block">Microsoft</strong><span className="text-muted-foreground">SSO corporativo</span></button></div></fieldset>
          <label className="mt-4 block text-xs font-medium" htmlFor="novo-nome">Nome</label><input id="novo-nome" maxLength={120} value={nome} onChange={(event) => setNome(event.target.value)} className={campo} />
          <label className="mt-4 block text-xs font-medium" htmlFor="novo-email">E-mail</label><input id="novo-email" type="email" autoComplete="off" required value={email} onChange={(event) => setEmail(event.target.value)} className={campo} />
          {metodo === "local" && <><label className="mt-4 block text-xs font-medium" htmlFor="nova-senha">Senha inicial</label><input id="nova-senha" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={senha} onChange={(event) => setSenha(event.target.value)} className={campo} /></>}
          <label className="mt-4 block text-xs font-medium" htmlFor="tipo-usuario">Permissão</label><select id="tipo-usuario" value={tipo} onChange={(event) => setTipo(event.target.value as "comum" | "admin")} className={campo}><option value="comum">Comum — visualiza e edita</option><option value="admin">Administrador — também exclui</option></select>
          <Button type="submit" className="mt-4 w-full" disabled={salvando}>{salvando ? "Salvando..." : metodo === "local" ? "Criar conta" : "Liberar Microsoft SSO"}</Button></form>
          <div><h3 className="text-sm font-semibold">Acessos liberados · {controle.usuarios.length}</h3><div className="mt-3 divide-y rounded-xl border">{controle.usuarios.map((usuario) => <div key={usuario.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><strong className="block truncate text-sm">{usuario.nome || usuario.email}</strong><span className="block truncate text-xs text-muted-foreground">{usuario.email}</span><span className="text-[11px] text-muted-foreground">{usuario.metodo === "microsoft" ? usuario.confirmado ? "Microsoft vinculado" : "Aguardando primeiro SSO" : "Conta local"}</span></div><div className="flex items-center gap-2"><select aria-label={`Permissão de ${usuario.email}`} value={usuario.tipo} disabled={usuario.id === controle.usuarioAtualId} onChange={(event) => { void alterarTipo(usuario.id, event.target.value as "comum" | "admin"); }} className="h-9 rounded-lg border bg-background px-2 text-xs"><option value="comum">Comum</option><option value="admin">Admin</option></select><Button size="icon" variant="ghost" aria-label={`Excluir ${usuario.email}`} disabled={usuario.id === controle.usuarioAtualId} onClick={() => { void remover(usuario.id, usuario.email); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}{!controle.usuarios.length && <p className="p-4 text-xs text-muted-foreground">Nenhum acesso cadastrado.</p>}</div></div></div> : <p className="mt-5 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Sua conta é comum. Você pode visualizar e editar todo o acervo; somente administradores controlam usuários e exclusões.</p>}
      </section>
      <div className="grid gap-4 md:grid-cols-2"><section className="hub-card rounded-2xl p-5"><Mic2 className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Vozes da narração</h2><p className="mt-1 text-xs text-muted-foreground">A principal é aplicada automaticamente; a alternativa aparece no seletor do tutorial.</p><div className="mt-4 space-y-2">{config.vozes.map((voz) => <div key={voz.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><span className="text-sm font-medium">{voz.nome}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${voz.padrao ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{voz.padrao ? "Padrão" : "Opcional"}</span></div>)}{!config.vozes.length && <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Nenhuma voz configurada no servidor.</p>}</div></section>
        <section className="hub-card rounded-2xl p-5"><Gauge className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Limites de vídeo</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tamanho máximo</dt><dd className="font-medium">{Math.round(config.limiteBytes / 1024 / 1024)} MB</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Duração máxima</dt><dd className="font-medium">{Math.round(config.limiteDuracaoMs / 60000)} minutos</dd></div></dl></section>
        <section className="hub-card rounded-2xl p-5"><Captions className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Geração padrão</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Processamento</dt><dd className="font-medium">Padrão</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Legendas</dt><dd className="font-medium">Ativadas</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ajuste de texto</dt><dd className="font-medium">Automático</dd></div></dl></section>
        <section className="hub-card rounded-2xl p-5"><Database className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Armazenamento</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">{config.retencao}</p></section></div>
    </>}
  </div>;
}
