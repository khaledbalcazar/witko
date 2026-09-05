"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  comments,
  mediaAssets,
  mediaTags,
  postTargets,
  posts,
  socialAccounts,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { exigirSesion } from "@/lib/auth/sesion";
import { aplicarTransicion } from "@/lib/workflow/apply";
import type { AccionWorkflow } from "@/lib/workflow/types";
import {
  comentarioSchema,
  crearPostSchema,
  guardarPostSchema,
} from "@/lib/validation/post";
import { PLATAFORMA_DE_TIPO } from "@/lib/validation/tipos";

/**
 * Server actions de publicaciones.
 *
 * Ninguna escribe `posts.estado` directamente: los cambios de estado pasan
 * siempre por `aplicarTransicion`, que valida rol y transicion y deja rastro
 * en el audit_log.
 */

export interface Respuesta {
  ok: boolean;
  mensaje?: string;
  postId?: string;
}

/** Verifica que el post sea de una marca del usuario. */
async function postDeMiMarca(postId: string, brandId: string) {
  const filas = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.brandId, brandId)))
    .limit(1);
  return filas[0] ?? null;
}

export async function crearBorrador(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = crearPostSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const { tituloInterno, tipo, socialAccountIds } = parseo.data;

  const cuentas = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        inArray(socialAccounts.id, socialAccountIds),
        eq(socialAccounts.brandId, sesion.marcaActiva.id),
      ),
    );

  if (cuentas.length !== socialAccountIds.length) {
    return {
      ok: false,
      mensaje: "Alguna de las cuentas elegidas no pertenece a esta marca.",
    };
  }

  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        brandId: sesion.marcaActiva.id,
        autorId: sesion.usuario.id,
        tituloInterno,
        tipo,
        estado: "BORRADOR",
      })
      .returning();

    await tx.insert(postTargets).values(
      cuentas.map((c) => ({
        postId: post.id,
        socialAccountId: c.id,
        plataforma: c.plataforma,
        caption: "",
      })),
    );

    await registrarAuditoria(tx, {
      actorId: sesion.usuario.id,
      entidad: "post",
      entidadId: post.id,
      accion: "CREAR",
      diff: { tituloInterno, tipo },
    });

    return post.id;
  });

  revalidatePath("/posts");
  return { ok: true, postId };
}

/**
 * Guarda el contenido. Si el post ya salio de BORRADOR, la maquina de estados
 * lo devuelve a BORRADOR: no se aprueba una cosa y se publica otra.
 */
export async function guardarPost(
  postId: string,
  datos: unknown,
): Promise<Respuesta & { volvioABorrador?: boolean }> {
  const sesion = await exigirSesion();
  const post = await postDeMiMarca(postId, sesion.marcaActiva.id);
  if (!post) return { ok: false, mensaje: "No encontramos esa publicacion." };

  const parseo = guardarPostSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }
  const contenido = parseo.data;

  const estadoAnterior = post.estado;

  const transicion = await aplicarTransicion({
    postId,
    accion: "EDITAR_CONTENIDO",
    usuarioId: sesion.usuario.id,
  });

  if (!transicion.ok) {
    return { ok: false, mensaje: transicion.motivo };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({
        tituloInterno: contenido.tituloInterno,
        tipo: contenido.tipo,
        scheduledAt: contenido.scheduledAt,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId));

    // Reordenar los medios segun como quedaron en el formulario.
    for (const [indice, mediaId] of contenido.mediaIds.entries()) {
      await tx
        .update(mediaAssets)
        .set({ orden: indice })
        .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.postId, postId)));
    }

    for (const destino of contenido.destinos) {
      const [actualizado] = await tx
        .update(postTargets)
        .set({
          caption: destino.caption,
          primerComentario: destino.primerComentario,
          altText: destino.altText,
          isAiGenerated: destino.isAiGenerated,
          locationId: destino.locationId,
          locationNombre: destino.locationNombre,
          config: destino.config,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(postTargets.postId, postId),
            eq(postTargets.socialAccountId, destino.socialAccountId),
          ),
        )
        .returning({ id: postTargets.id });

      if (!actualizado) continue;

      // Las etiquetas se reescriben enteras: son pocas y asi no hay que
      // reconciliar altas y bajas una por una.
      await tx.delete(mediaTags).where(eq(mediaTags.postTargetId, actualizado.id));

      if (destino.etiquetas.length > 0) {
        await tx.insert(mediaTags).values(
          destino.etiquetas.map((e) => ({
            postTargetId: actualizado.id,
            mediaAssetId: e.mediaAssetId,
            username: e.username,
            x: e.x != null ? String(e.x) : null,
            y: e.y != null ? String(e.y) : null,
          })),
        );
      }
    }
  });

  revalidatePath("/posts/" + postId);
  revalidatePath("/calendario");

  return {
    ok: true,
    volvioABorrador:
      estadoAnterior !== "BORRADOR" && estadoAnterior !== "CAMBIOS_SOLICITADOS",
  };
}

/** Punto unico para las acciones del flujo de aprobacion. */
export async function ejecutarTransicion(params: {
  postId: string;
  accion: AccionWorkflow;
  comentario?: string;
  scheduledAt?: string | null;
}): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const post = await postDeMiMarca(params.postId, sesion.marcaActiva.id);
  if (!post) return { ok: false, mensaje: "No encontramos esa publicacion." };

  const resultado = await aplicarTransicion({
    postId: params.postId,
    accion: params.accion,
    usuarioId: sesion.usuario.id,
    comentario: params.comentario ?? null,
    scheduledAt: params.scheduledAt ? new Date(params.scheduledAt) : null,
  });

  if (!resultado.ok) {
    return { ok: false, mensaje: resultado.motivo };
  }

  revalidatePath("/posts/" + params.postId);
  revalidatePath("/aprobaciones");
  revalidatePath("/calendario");
  revalidatePath("/tablero");

  return { ok: true, mensaje: "Listo." };
}

/** Mueve un post en el calendario arrastrandolo. */
export async function reprogramar(
  postId: string,
  scheduledAtIso: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const post = await postDeMiMarca(postId, sesion.marcaActiva.id);
  if (!post) return { ok: false, mensaje: "No encontramos esa publicacion." };

  if (post.estado !== "APROBADO" && post.estado !== "PROGRAMADO") {
    return {
      ok: false,
      mensaje:
        "Solo se pueden mover publicaciones aprobadas o programadas. Esta esta en " +
        post.estado +
        ".",
    };
  }

  // Si ya estaba programada, primero se saca de la cola y despues se vuelve a
  // encolar con el horario nuevo.
  if (post.estado === "PROGRAMADO") {
    const cancelacion = await aplicarTransicion({
      postId,
      accion: "CANCELAR_PROGRAMACION",
      usuarioId: sesion.usuario.id,
    });
    if (!cancelacion.ok) {
      return { ok: false, mensaje: cancelacion.motivo };
    }
  }

  const resultado = await aplicarTransicion({
    postId,
    accion: "PROGRAMAR",
    usuarioId: sesion.usuario.id,
    scheduledAt: new Date(scheduledAtIso),
  });

  if (!resultado.ok) return { ok: false, mensaje: resultado.motivo };

  revalidatePath("/calendario");
  return { ok: true };
}

export async function comentar(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = comentarioSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const post = await postDeMiMarca(parseo.data.postId, sesion.marcaActiva.id);
  if (!post) return { ok: false, mensaje: "No encontramos esa publicacion." };

  await db.insert(comments).values({
    postId: parseo.data.postId,
    autorId: sesion.usuario.id,
    cuerpo: parseo.data.cuerpo,
  });

  revalidatePath("/posts/" + parseo.data.postId);
  return { ok: true };
}

export async function eliminarMedia(
  postId: string,
  mediaId: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const post = await postDeMiMarca(postId, sesion.marcaActiva.id);
  if (!post) return { ok: false, mensaje: "No encontramos esa publicacion." };

  if (post.estado === "PUBLICADO" || post.estado === "PUBLICANDO") {
    return { ok: false, mensaje: "Esta publicacion ya no se puede editar." };
  }

  await db
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.postId, postId)));

  revalidatePath("/posts/" + postId);
  return { ok: true };
}

/** Tipos de post validos para el conjunto de cuentas elegido. */
export async function tiposDisponibles(
  socialAccountIds: string[],
): Promise<string[]> {
  const sesion = await exigirSesion();
  const cuentas = await db
    .select({ plataforma: socialAccounts.plataforma })
    .from(socialAccounts)
    .where(
      and(
        inArray(socialAccounts.id, socialAccountIds),
        eq(socialAccounts.brandId, sesion.marcaActiva.id),
      ),
    );

  const plataformas = new Set(cuentas.map((c) => c.plataforma));

  return Object.entries(PLATAFORMA_DE_TIPO)
    .filter(([, plataforma]) => plataformas.has(plataforma))
    .map(([tipo]) => tipo);
}
