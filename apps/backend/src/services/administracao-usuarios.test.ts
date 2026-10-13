import { expect, it } from "vitest";
import { alterarStatusUsuario, autorizarUsuario, listarUsuarios } from "./administracao-usuarios";

it("recusa identidade sem perfil previamente liberado", async () => {
  const cliente = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }), ilike: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) } as never;
  await expect(autorizarUsuario(cliente, { id: "auth", email: "novo@empresa.com" } as never)).resolves.toBeNull();
});

it("aceita perfil ativo ligado à identidade", async () => {
  const perfil = { id: "perfil", auth_id: "auth", email: "user@empresa.com", status: "ativo", tipo: "comum" };
  const cliente = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: perfil, error: null }) }) }) }) } as never;
  await expect(autorizarUsuario(cliente, { id: "auth", email: perfil.email } as never)).resolves.toBe(perfil);
});

it("vincula o perfil previamente liberado no primeiro login Microsoft", async () => {
  const perfil = { id: "perfil", auth_id: null, email: "sso@empresa.com", status: "ativo", tipo: "comum" };
  const vinculado = { ...perfil, auth_id: "auth-microsoft" };
  const tabela = {
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      ilike: () => ({ maybeSingle: () => Promise.resolve({ data: perfil, error: null }) })
    }),
    update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: vinculado, error: null }) }) }) })
  };
  const cliente = { from: () => tabela } as never;
  await expect(autorizarUsuario(cliente, { id: "auth-microsoft", email: perfil.email } as never)).resolves.toEqual(vinculado);
});

it("lista os perfis mesmo quando o provedor de identidades está indisponível", async () => {
  const perfil = { id: "perfil", auth_id: "auth", email: "admin@empresa.com", nome: null, status: "ativo", tipo: "admin", metodo: "local", criado_em: "2026-10-11", atualizado_em: "2026-10-11" };
  const cliente = {
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [perfil], error: null }) }) }),
    auth: { admin: { listUsers: () => Promise.resolve({ data: { users: [] }, error: { message: "Database error finding users" } }) } }
  } as never;

  await expect(listarUsuarios(cliente)).resolves.toEqual([{ ...perfil, confirmado: true, ultimoAcessoEm: null }]);
});

it("bloqueia um usuário sem apagar o perfil usado pelo autocomplete", async () => {
  const perfil = { id: "perfil", auth_id: "auth", status: "ativo" };
  const bloqueado = { ...perfil, status: "bloqueado" };
  const cliente = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: perfil, error: null }) }) }),
    update: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: bloqueado, error: null }) }) }) })
  }) } as never;
  await expect(alterarStatusUsuario(cliente, "perfil", "bloqueado", "outro-auth")).resolves.toEqual(bloqueado);
});
