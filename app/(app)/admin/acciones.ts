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

  if (error || !data.user) {
    return {
      ok: false,
      mensaje: "No se pudo crear el usuario: " + (error?.message ?? "error desconocido"),
    };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: data.user.id,
        nombre,
        email: email.toLowerCase(),
        rol,
      });

      await tx.insert(brandMembers).values(
        brandIds.map((brandId) => ({ brandId, userId: data.user.id, rol })),
      );

      await registrarAuditoria(tx, {
        actorId: sesion.usuario.id,
        entidad: "user",
        entidadId: data.user.id,
        accion: "INVITAR",
        diff: { nombre, email, rol, brandIds },
      });
    });
  } catch (error) {
    // Si falla la parte nuestra, se borra el usuario de Auth: dejar uno suelto
    // que no existe en `users` haria que no pueda entrar ni ser reinvitado.
    await supabase.auth.admin.deleteUser(data.user.id);
    console.error(error);
    return { ok: false, mensaje: "No se pudo completar el alta." };
  }

  revalidatePath("/admin/usuarios");
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
