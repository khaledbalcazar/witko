"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { brandMembers, brands, socialAccounts, users } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { exigirAdmin } from "@/lib/auth/sesion";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { cifrarToken } from "@/lib/crypto/tokens";

export interface Respuesta {
  ok: boolean;
  mensaje?: string;
  /** Contrasena temporal, solo al crear el usuario. */
  passwordTemporal?: string;
}

/* ------------------------------------------------------------------ */
/* Usuarios                                                            */
/* ------------------------------------------------------------------ */

function correoNormalizado(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Busca un usuario en Supabase Auth por correo. La API de administracion no
 * expone un filtro directo, asi que se recorre la primera pagina: para un
 * equipo de marketing alcanza de sobra.
 */
async function buscarEnAuth(
  supabase: ReturnType<typeof supabaseAdmin>,
  email: string,
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
}

const invitacionSchema = z.object({
  nombre: z.string().trim().min(1, "Falta el nombre.").max(120),
  email: z.email("Ese correo no parece valido."),
  rol: z.enum(["CM", "JEFE", "ADMIN"]),
  brandIds: z.array(z.string().uuid()).min(1, "Elegi al menos una marca."),
});

/**
 * Crea el usuario en Supabase Auth y lo da de alta en las marcas elegidas.
 *
 * Devuelve una contrasena temporal generada al azar, que el admin le pasa a la
 * persona por el canal que quiera. No se manda por email porque en Fase 0
 * todavia no hay dominio verificado para enviar correos.
 */
export async function invitarUsuario(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirAdmin();
  const parseo = invitacionSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const { nombre, email, rol, brandIds } = parseo.data;

  const existente = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existente.length > 0) {
    return { ok: false, mensaje: "Ya hay un usuario con ese correo." };
  }

  const passwordTemporal = randomBytes(9).toString("base64url");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.toLowerCase(),
    password: passwordTemporal,
    email_confirm: true,
    user_metadata: { nombre },
  });

  let userId = data?.user?.id;

  if (error || !userId) {
    // Puede existir en Supabase Auth pero no en nuestra tabla: pasa si un alta
    // anterior quedo a medias. En ese caso se lo adopta con una contrasena
    // nueva, en vez de dejar un correo inutilizable para siempre.
    const existenteEnAuth = await buscarEnAuth(supabase, correoNormalizado(email));

    if (!existenteEnAuth) {
      return {
        ok: false,
        mensaje:
          "No se pudo crear el usuario: " +
          (error?.message ?? "error desconocido"),
      };
    }

    const { error: fallo } = await supabase.auth.admin.updateUserById(
      existenteEnAuth,
      { password: passwordTemporal, email_confirm: true },
    );

    if (fallo) {
      return {
        ok: false,
        mensaje: "El correo ya existe y no se pudo reutilizar: " + fallo.message,
      };
    }

    userId = existenteEnAuth;
  }

  const id = userId;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        nombre,
        email: correoNormalizado(email),
        rol,
      });

      await tx
        .insert(brandMembers)
        .values(brandIds.map((brandId) => ({ brandId, userId: id, rol })));

      await registrarAuditoria(tx, {
        actorId: sesion.usuario.id,
        entidad: "user",
        entidadId: id,
        accion: "INVITAR",
        diff: { nombre, email, rol, brandIds },
      });
    });
  } catch (error) {
    console.error("Fallo el alta de usuario:", error);
    return {
      ok: false,
      mensaje:
        "Se creo la cuenta pero no se pudo dar de alta en el sistema. " +
        "Volve a intentar; si sigue fallando, revisa los registros del servidor.",
    };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true, passwordTemporal };
}

/**
 * Genera una contrasena nueva para un usuario y la devuelve una sola vez.
 *
 * Es lo que reemplaza al "olvide mi contrasena" mientras no haya envio de
 * correos: quien administra la genera y se la pasa a la persona.
 */
export async function resetearPassword(userId: string): Promise<Respuesta> {
  const sesion = await exigirAdmin();

  const filas = await db
    .select({ nombre: users.nombre, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (filas.length === 0) {
    return { ok: false, mensaje: "No encontramos ese usuario." };
  }

  const passwordTemporal = randomBytes(9).toString("base64url");

  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    password: passwordTemporal,
  });

  if (error) {
    return {
      ok: false,
      mensaje: "No se pudo cambiar la contrasena: " + error.message,
    };
  }

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "user",
    entidadId: userId,
    accion: "RESETEAR_PASSWORD",
  });

  return { ok: true, passwordTemporal };
}

export async function cambiarRolEnMarca(
  userId: string,
  brandId: string,
  rol: "CM" | "JEFE" | "ADMIN",
): Promise<Respuesta> {
  const sesion = await exigirAdmin();

  await db
    .update(brandMembers)
    .set({ rol })
    .where(and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)));

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "user",
    entidadId: userId,
    accion: "CAMBIAR_ROL",
    diff: { brandId, rol },
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function activarUsuario(
  userId: string,
  activo: boolean,
): Promise<Respuesta> {
  const sesion = await exigirAdmin();

  if (userId === sesion.usuario.id && !activo) {
    return { ok: false, mensaje: "No podes desactivarte a vos mismo." };
  }

  await db.update(users).set({ activo }).where(eq(users.id, userId));

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "user",
    entidadId: userId,
    accion: activo ? "ACTIVAR" : "DESACTIVAR",
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Cuentas sociales                                                    */
/* ------------------------------------------------------------------ */

const cuentaSchema = z.object({
  brandId: z.string().uuid(),
  plataforma: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK"]),
  externalAccountId: z.string().trim().min(1, "Falta el id de la cuenta."),
  nombreVisible: z.string().trim().min(1, "Falta el nombre visible.").max(120),
  accessToken: z.string().trim().optional(),
  expiraEn: z.coerce.date().nullable().optional(),
});

/**
 * Alta manual de una cuenta.
 *
 * En Fase 1 y 2 esto lo hace el flujo OAuth. Mientras tanto, el alta a mano
 * permite armar las cuentas de Witko y Palma Travel y usar todo el circuito
 * contra el adaptador simulado.
 */
export async function guardarCuenta(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirAdmin();
  const parseo = cuentaSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const { accessToken, ...campos } = parseo.data;

  if (!sesion.marcas.some((m) => m.id === campos.brandId)) {
    return { ok: false, mensaje: "Esa marca no existe o no la administras." };
  }

  const valores = {
    ...campos,
    // Con adaptadores simulados no hay token real, pero la columna no puede
    // quedar vacia: el validador rechaza publicar sin token.
    accessTokenCifrado: cifrarToken(accessToken?.trim() || "token-simulado"),
    updatedAt: new Date(),
  };

  await db
    .insert(socialAccounts)
    .values(valores)
    .onConflictDoUpdate({
      target: [
        socialAccounts.brandId,
        socialAccounts.plataforma,
        socialAccounts.externalAccountId,
      ],
      set: {
        nombreVisible: valores.nombreVisible,
        accessTokenCifrado: valores.accessTokenCifrado,
        expiraEn: valores.expiraEn ?? null,
        activo: true,
        updatedAt: new Date(),
      },
    });

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "social_account",
    entidadId: campos.brandId,
    accion: "CONECTAR",
    diff: {
      plataforma: campos.plataforma,
      externalAccountId: campos.externalAccountId,
    },
  });

  revalidatePath("/admin/cuentas");
  return { ok: true };
}

export async function desconectarCuenta(cuentaId: string): Promise<Respuesta> {
  const sesion = await exigirAdmin();

  await db
    .update(socialAccounts)
    .set({ activo: false, updatedAt: new Date() })
    .where(eq(socialAccounts.id, cuentaId));

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "social_account",
    entidadId: cuentaId,
    accion: "DESCONECTAR",
  });

  revalidatePath("/admin/cuentas");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Marcas                                                              */
/* ------------------------------------------------------------------ */

export async function ajustarMarca(
  brandId: string,
  cambios: {
    permitirAutoAprobacion?: boolean;
    modoTiktok?: "MEDIA_UPLOAD" | "DIRECT_POST";
  },
): Promise<Respuesta> {
  const sesion = await exigirAdmin();

  await db.update(brands).set(cambios).where(eq(brands.id, brandId));

  await registrarAuditoria(db, {
    actorId: sesion.usuario.id,
    entidad: "brand",
    entidadId: brandId,
    accion: "AJUSTAR",
    diff: cambios,
  });

  revalidatePath("/admin/marcas");
  return { ok: true };
}
