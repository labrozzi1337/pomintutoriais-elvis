import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

export function getPominsacClient(): SupabaseClient {
  if (cliente) return cliente;
  const url = import.meta.env.VITE_POMINSAC_SUPABASE_URL;
  const key = import.meta.env.VITE_POMINSAC_SUPABASE_ANON_KEY;
  cliente = createClient(url || "https://placeholder.supabase.co", key || "placeholder-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: "pominsac-anon" }
  });
  return cliente;
}
