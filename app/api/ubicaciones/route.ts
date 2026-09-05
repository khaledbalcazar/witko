import { NextResponse } from "next/server";
import { exigirSesion } from "@/lib/auth/sesion";
import { buscadorUbicaciones } from "@/lib/places/buscador";

export async function GET(request: Request) {
  await exigirSesion();

  const consulta = new URL(request.url).searchParams.get("q") ?? "";
  const resultados = await buscadorUbicaciones().buscar(consulta);

  return NextResponse.json({ ok: true, resultados });
}
