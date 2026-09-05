"use server";

import { cookies } from "next/headers";
import { COOKIE_MARCA, obtenerSesion } from "@/lib/auth/sesion";

/** Cambia la marca sobre la que trabaja el usuario. */
export async function cambiarMarca(marcaId: string): Promise<void> {
  const sesion = await obtenerSesion();
  if (!sesion) return;

  // Solo se puede cambiar a una marca donde el usuario es miembro: si no, la
  // cookie seria una forma de mirar datos ajenos.
  if (!sesion.marcas.some((m) => m.id === marcaId)) return;

  const almacen = await cookies();
  almacen.set(COOKIE_MARCA, marcaId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
