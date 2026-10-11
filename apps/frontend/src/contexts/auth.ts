import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  autorizado: boolean | null;
  tipo: "comum" | "admin" | null;
  acessoNegado: string | null;
  configurationError: boolean;
  entrar: (email: string, senha: string) => Promise<string | null>;
  entrarMicrosoft: () => Promise<string | null>;
  sair: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Expõe a sessão Supabase atual aos componentes protegidos. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  return context;
}
