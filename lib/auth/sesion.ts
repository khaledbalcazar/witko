import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brandMembers, brands, users } from "@/db/schema";
import type { Rol } from "@/lib/workflow/types";
import { supabaseServidor } from "./supabase";

/**
 * Sesion del lado del servidor: quien es el usuario y sobre que marca esta
 * trabajando. La marca activa se guarda en una cookie porque un usuario puede
 * estar en Witko y en Palma Travel a la vez.
 */

export const COOKIE_MARCA = "marca_activa";

export interface Marca {
  id: string;
  nombre: string;
  slug: string;
  timezone: string;
  permitirAutoAprobacion: boolean;
  modoTiktok: "MEDIA_UPLOAD" | "DIRECT_POST";
  /** Rol del usuario en esta marca. */
  rolEnMarca: Rol;
}

export interface Sesion {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
  };
  marcas: Marca[];
  marcaActiva: Marca;
}

/** Cacheado por request: varios componentes la piden en el mismo render. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const filas = await db
    .select({ usuario: users })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Existe en Supabase Auth pero no en nuestra tabla: alta a medio hacer.
  if (filas.length === 0 || !filas[0].usuario.activo) return null;

  const usuario = filas[0].usuario;

  const membresias = await db
    .select({ marca: brands, rol: brandMembers.rol })
    .from(brandMembers)
    .innerJoin(brands, eq(brands.id, brandMembers.brandId))
    .where(and(eq(brandMembers.userId, user.id), eq(brands.activo, true)))
    .orderBy(asc(brands.nombre));

  const marcas: Marca[] = membresias.map((m) => ({
    id: m.marca.id,
    nombre: m.marca.nombre,
    slug: m.marca.slug,
    timezone: m.marca.timezone,
    permitirAutoAprobacion: m.marca.permitirAutoAprobacion,
    modoTiktok: m.marca.modoTiktok,
    rolEnMarca: m.rol as Rol,
  }));

  if (marcas.length === 0) return null;

  const almacen = await cookies();
  const elegida = almacen.get(COOKIE_MARCA)?.value;
  const marcaActiva = marcas.find((m) => m.id === elegida) ?? marcas[0];

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol as Rol,
    },
    marcas,
    marcaActiva,
  };
});

/** Para las pantallas que exigen sesion. Redirige al login si no hay. */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  return sesion;
}

/** Para las pantallas de jefe y admin. */
export async function exigirAprobador(): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (sesion.marcaActiva.rolEnMarca === "CM" && sesion.usuario.rol !== "ADMIN") {
    redirect("/");
  }
  return sesion;
}

export async function exigirAdmin(): Promise<Sesion> {
  const sesion = await exigirSesion();
  if (sesion.usuario.rol !== "ADMIN") redirect("/");
  return sesion;
}

export function puedeAprobar(sesion: Sesion): boolean {
  return (
    sesion.marcaActiva.rolEnMarca === "JEFE" ||
    sesion.marcaActiva.rolEnMarca === "ADMIN" ||
    sesion.usuario.rol === "ADMIN"
  );
}
