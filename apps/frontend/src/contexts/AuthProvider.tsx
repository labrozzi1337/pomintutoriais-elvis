import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { AuthContext } from "@/contexts/auth";
import { autenticacaoConfigurada, supabase } from "@/integrations/supabase/client";
import { API_URL } from "@/lib/api";

const sessaoSchema = z.object({ data: z.object({ email: z.string(), tipo: z.enum(["comum", "admin"]) }) });

/** Mantém a sessão do portal e reage a login, logout e refresh do token. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(autenticacaoConfigurada);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [tipo, setTipo] = useState<"comum" | "admin" | null>(null);
  const [acessoNegado, setAcessoNegado] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ativo = true;
    const token = session?.access_token;
    if (!token) {
      void Promise.resolve().then(() => { if (ativo) { setAutorizado(null); setTipo(null); } });
      return () => { ativo = false; };
    }
    void fetch(`${API_URL}/api/v1/auth/sessao`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!ativo) return;
        if (!response.ok) {
          const corpo = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          setAutorizado(false); setTipo(null); setAcessoNegado(corpo?.error?.message ?? "Seu e-mail não está liberado para acessar esta plataforma.");
          await supabase?.auth.signOut();
          return;
        }
        const resultado = sessaoSchema.safeParse(await response.json());
        if (!resultado.success) throw new Error("SESSION_RESPONSE_INVALID");
        setAutorizado(true); setTipo(resultado.data.data.tipo); setAcessoNegado(null);
      })
      .catch(async () => {
        if (!ativo) return;
        setAutorizado(false); setTipo(null); setAcessoNegado("Não foi possível verificar seu acesso. Tente entrar novamente.");
        await supabase?.auth.signOut();
      });
    return () => { ativo = false; };
  }, [session?.access_token]);

  const value = useMemo(() => ({
    session,
    loading,
    autorizado,
    tipo,
    acessoNegado,
    configurationError: !autenticacaoConfigurada,
    entrar: async (email: string, senha: string) => {
      if (!supabase) return "Autenticação não configurada.";
      setAcessoNegado(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      return error ? "E-mail ou senha inválidos." : null;
    },
    entrarMicrosoft: async () => {
      if (!supabase) return "Autenticação não configurada.";
      setAcessoNegado(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: { scopes: "openid profile email", redirectTo: `${window.location.origin}/entrar` }
      });
      return error ? "Não foi possível iniciar o acesso com a Microsoft." : null;
    },
    sair: async () => { setAutorizado(null); setTipo(null); if (supabase) await supabase.auth.signOut(); }
  }), [acessoNegado, autorizado, loading, session, tipo]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
