import { useEffect, useState, type FormEvent } from "react";
import { Building2, KeyRound, UserPlus, UserX, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/auth";
import { alterarStatusUsuario, alterarTipoUsuario, criarUsuario, listarUsuarios, type ControleUsuarios } from "@/lib/estudio-api";

const campo = "mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function UsersPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const [controle, setControle] = useState<ControleUsuarios | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [metodo, setMetodo] = useState<"local" | "microsoft">("local");
  const [tipo, setTipo] = useState<"comum" | "admin">("comum");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const bloqueado = controle?.bloqueados.find((usuario) => usuario.email.toLocaleLowerCase() === email.trim().toLocaleLowerCase());

  useEffect(() => {
    let ativo = true;
    void listarUsuarios(token).then((dados) => { if (ativo) setControle(dados); }).catch((error: unknown) => { if (ativo) setErro(error instanceof Error ? error.message : "Não foi possível carregar os usuários."); });
    return () => { ativo = false; };
  }, [token]);

  async function recarregar() { setControle(await listarUsuarios(token)); }

  function atualizarEmail(valor: string) {
    setEmail(valor);
    const usuario = controle?.bloqueados.find((item) => item.email.toLocaleLowerCase() === valor.trim().toLocaleLowerCase());
    if (usuario) { setNome(usuario.nome ?? ""); setMetodo(usuario.metodo); setTipo(usuario.tipo); setSenha(""); }
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setErro(""); setSucesso(""); setSalvando(true);
    try {
      if (bloqueado) {
        await alterarStatusUsuario(token, bloqueado.id, "ativo");
        setSucesso("Acesso reativado.");
      } else {
        await criarUsuario(token, { email: email.trim(), nome: nome.trim() || undefined, tipo, metodo, ...(metodo === "local" ? { senha } : {}) });
        setSucesso(metodo === "local" ? "Conta criada e liberada." : "E-mail liberado para o Microsoft SSO.");
      }
      setNome(""); setEmail(""); setSenha(""); setTipo("comum"); setMetodo("local");
      await recarregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar o usuário."); }
    finally { setSalvando(false); }
  }

  async function desativar(usuarioId: string, usuarioEmail: string) {
    if (!window.confirm(`Desativar o acesso de ${usuarioEmail}?`)) return;
    setErro(""); setSucesso("");
    try { await alterarStatusUsuario(token, usuarioId, "bloqueado"); setSucesso("Acesso desativado."); await recarregar(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível desativar o usuário."); }
  }

  async function alterarTipo(usuarioId: string, novoTipo: "comum" | "admin") {
    setErro(""); setSucesso("");
    try { await alterarTipoUsuario(token, usuarioId, novoTipo); setSucesso("Permissão atualizada."); await recarregar(); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível atualizar a permissão."); }
  }

  return <div className="mx-auto min-h-full max-w-[1100px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header><p className="eyebrow">Administração</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Controle de usuários</h1><p className="mt-2 text-sm text-muted-foreground">Somente os acessos exibidos como ativos podem entrar na plataforma.</p></header>
    {erro && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}{sucesso && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{sucesso}</p>}
    {!controle ? !erro && <p className="text-sm text-muted-foreground">Carregando usuários…</p> : !controle.administrador ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Somente administradores podem controlar usuários.</p> : <section className="hub-card rounded-2xl p-5">
      <Users className="h-5 w-5 text-primary" /><h2 className="mt-3 font-semibold">Usuários e formas de acesso</h2><p className="mt-1 text-sm text-muted-foreground">Digite um e-mail novo ou escolha uma conta desativada no autocomplete para reativá-la.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border p-4"><Building2 className="h-5 w-5" /><strong className="mt-2 block text-sm">Microsoft SSO</strong><span className="mt-1 block text-xs text-muted-foreground">A identidade é vinculada no primeiro login.</span></div><div className="rounded-xl border p-4"><KeyRound className="h-5 w-5" /><strong className="mt-2 block text-sm">Conta local</strong><span className="mt-1 block text-xs text-muted-foreground">Uma conta nova recebe uma senha inicial.</span></div></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]"><form onSubmit={(event) => { void salvar(event); }} className="rounded-xl border p-4"><div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Cadastrar ou reativar</h3></div>
        <label className="mt-4 block text-xs font-medium" htmlFor="novo-email">E-mail</label><input id="novo-email" type="email" list="usuarios-bloqueados" autoComplete="off" required value={email} onChange={(event) => atualizarEmail(event.target.value)} className={campo} /><datalist id="usuarios-bloqueados">{controle.bloqueados.map((usuario) => <option key={usuario.id} value={usuario.email}>{usuario.nome ?? "Conta desativada"}</option>)}</datalist>
        {bloqueado ? <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">Conta desativada encontrada. Ela será reativada sem criar outro cadastro.</p> : <><fieldset className="mt-4"><legend className="text-xs font-medium">Forma de entrada</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" aria-pressed={metodo === "local"} onClick={() => setMetodo("local")} className={`rounded-lg border p-3 text-left text-xs ${metodo === "local" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><strong className="block">E-mail e senha</strong><span className="text-muted-foreground">Conta local</span></button><button type="button" aria-pressed={metodo === "microsoft"} onClick={() => setMetodo("microsoft")} className={`rounded-lg border p-3 text-left text-xs ${metodo === "microsoft" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><strong className="block">Microsoft</strong><span className="text-muted-foreground">SSO corporativo</span></button></div></fieldset>
          <label className="mt-4 block text-xs font-medium" htmlFor="novo-nome">Nome</label><input id="novo-nome" maxLength={120} value={nome} onChange={(event) => setNome(event.target.value)} className={campo} />
          {metodo === "local" && <><label className="mt-4 block text-xs font-medium" htmlFor="nova-senha">Senha inicial</label><input id="nova-senha" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={senha} onChange={(event) => setSenha(event.target.value)} className={campo} /></>}
          <label className="mt-4 block text-xs font-medium" htmlFor="tipo-usuario">Permissão</label><select id="tipo-usuario" value={tipo} onChange={(event) => setTipo(event.target.value as "comum" | "admin")} className={campo}><option value="comum">Comum — visualiza e edita</option><option value="admin">Administrador — também exclui</option></select></>}
        <Button type="submit" className="mt-4 w-full" disabled={salvando}>{salvando ? "Salvando..." : bloqueado ? "Reativar acesso" : "Cadastrar usuário"}</Button></form>
        <div><h3 className="text-sm font-semibold">Acessos ativos · {controle.usuarios.length}</h3><div className="mt-3 divide-y rounded-xl border">{controle.usuarios.map((usuario) => <div key={usuario.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><strong className="block truncate text-sm">{usuario.nome || usuario.email}</strong><span className="block truncate text-xs text-muted-foreground">{usuario.email}</span><span className="text-[11px] text-muted-foreground">{usuario.metodo === "microsoft" ? usuario.confirmado ? "Microsoft vinculado" : "Aguardando primeiro SSO" : "Conta local"}</span></div><div className="flex items-center gap-2"><select aria-label={`Permissão de ${usuario.email}`} value={usuario.tipo} disabled={usuario.id === controle.usuarioAtualId} onChange={(event) => { void alterarTipo(usuario.id, event.target.value as "comum" | "admin"); }} className="h-9 rounded-lg border bg-background px-2 text-xs"><option value="comum">Comum</option><option value="admin">Admin</option></select><Button size="icon" variant="ghost" aria-label={`Desativar ${usuario.email}`} title="Desativar acesso" disabled={usuario.id === controle.usuarioAtualId} onClick={() => { void desativar(usuario.id, usuario.email); }}><UserX className="h-4 w-4 text-destructive" /></Button></div></div>)}{!controle.usuarios.length && <p className="p-4 text-xs text-muted-foreground">Nenhum acesso ativo.</p>}</div></div></div>
    </section>}
  </div>;
}
