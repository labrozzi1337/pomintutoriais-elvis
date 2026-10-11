import { obterContextoApi } from "@/lib/api-context";
import { respostaErro, tratarExcecao } from "@/lib/http";
import { validarUuid } from "@/lib/schemas";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export async function DELETE(request: Request, { params }: { params: Promise<{ dispositivoId: string }> }): Promise<Response> {
  try {
    const contexto = await obterContextoApi(request);
    if (!contexto.ok) return contexto.response;
    const resultado = await contexto.auth.cliente.from("launcher_dispositivos").update({ ativo: false }).eq("id", validarUuid((await params).dispositivoId)).eq("proprietario_id", contexto.auth.usuario.id).select("id").maybeSingle();
    if (resultado.error) throw new Error("LAUNCHER_REVOKE_FAILED");
    return resultado.data ? new NextResponse(null, { status: 204 }) : respostaErro("NOT_FOUND", "Dispositivo não encontrado.", 404);
  } catch (error) { return tratarExcecao(error, crypto.randomUUID()); }
}
