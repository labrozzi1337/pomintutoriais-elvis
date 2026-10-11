import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth";

/** Bloqueia rotas do Estúdio até existir uma sessão válida. */
export function ProtectedRoute() {
  const { session, loading, autorizado } = useAuth();
  const location = useLocation();
  if (loading || (session && autorizado === null)) return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">Validando sessão...</main>;
  return session && autorizado ? <Outlet /> : <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
}
