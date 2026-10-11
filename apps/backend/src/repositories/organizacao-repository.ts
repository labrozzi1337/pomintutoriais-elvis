import type { AuthenticatedSupabaseClient } from "@/integrations/supabase/auth";

export async function listarOrganizacao(cliente: AuthenticatedSupabaseClient) {
  const [{ data: empresas, error: empresasError }, { data: areas, error: areasError }] = await Promise.all([
    cliente.from("empresas").select("id,nome,criado_em").order("nome"),
    cliente.from("areas").select("id,empresa_id,nome,criado_em").order("nome")
  ]);
  if (empresasError || areasError) throw new Error("ORGANIZATION_LIST_FAILED", { cause: empresasError ?? areasError });
  return empresas.map((empresa) => ({ ...empresa, areas: areas.filter((area) => area.empresa_id === empresa.id) }));
}

export async function criarEmpresa(cliente: AuthenticatedSupabaseClient, usuarioId: string, nome: string) {
  const { data, error } = await cliente.from("empresas").insert({ proprietario_id: usuarioId, nome }).select("id,nome,criado_em").single();
  if (error) throw new Error("COMPANY_CREATE_FAILED", { cause: error });
  return data;
}

export async function criarArea(cliente: AuthenticatedSupabaseClient, usuarioId: string, empresaId: string, nome: string) {
  const { data, error } = await cliente.from("areas").insert({ proprietario_id: usuarioId, empresa_id: empresaId, nome }).select("id,empresa_id,nome,criado_em").single();
  if (error) throw new Error("AREA_CREATE_FAILED", { cause: error });
  return data;
}
