import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  approvals,
  comments,
  mediaAssets,
  mediaTags,
  postTargets,
  posts,
  socialAccounts,
  users,
} from "@/db/schema";

/**
 * Lecturas de publicaciones. Todas exigen brandId: no hay forma de pedir un
 * post sin decir de que marca, asi que no se puede leer el de otra por error.
 */

export type PostConTodo = Awaited<ReturnType<typeof obtenerPost>>;

export async function obtenerPost(postId: string, brandId: string) {
  const filas = await db
    .select({
      post: posts,
      autor: { id: users.id, nombre: users.nombre, email: users.email },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.autorId))
    .where(and(eq(posts.id, postId), eq(posts.brandId, brandId)))
    .limit(1);

  if (filas.length === 0) return null;

  const destinos = await db
    .select({ destino: postTargets, cuenta: socialAccounts })
    .from(postTargets)
    .innerJoin(socialAccounts, eq(socialAccounts.id, postTargets.socialAccountId))
    .where(eq(postTargets.postId, postId));

  const medios = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.postId, postId))
    .orderBy(asc(mediaAssets.orden));

  const etiquetas =
    destinos.length > 0
      ? await db
          .select()
          .from(mediaTags)
          .where(
            inArray(
              mediaTags.postTargetId,
              destinos.map((d) => d.destino.id),
            ),
          )
      : [];

  const hilo = await db
    .select({
      comentario: comments,
      autor: { id: users.id, nombre: users.nombre },
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.autorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));

  const historial = await db
    .select({
      aprobacion: approvals,
      revisor: { id: users.id, nombre: users.nombre },
    })
    .from(approvals)
    .innerJoin(users, eq(users.id, approvals.revisorId))
    .where(eq(approvals.postId, postId))
    .orderBy(desc(approvals.createdAt));

  return {
    ...filas[0],
    destinos: destinos.map((d) => ({
      ...d,
      etiquetas: etiquetas.filter((e) => e.postTargetId === d.destino.id),
    })),
    medios,
    hilo,
    historial,
  };
}

export interface FiltrosListado {
  estados?: Array<(typeof posts.estado.enumValues)[number]>;
  autorId?: string;
  desde?: Date;
  hasta?: Date;
  limite?: number;
}

export async function listarPosts(brandId: string, filtros: FiltrosListado = {}) {
  const condiciones = [eq(posts.brandId, brandId)];

  if (filtros.estados?.length) {
    condiciones.push(inArray(posts.estado, filtros.estados));
  }
  if (filtros.autorId) condiciones.push(eq(posts.autorId, filtros.autorId));
  if (filtros.desde) condiciones.push(gte(posts.scheduledAt, filtros.desde));
  if (filtros.hasta) condiciones.push(lte(posts.scheduledAt, filtros.hasta));

  const filas = await db
    .select({
      post: posts,
      autor: { id: users.id, nombre: users.nombre },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.autorId))
    .where(and(...condiciones))
    .orderBy(desc(posts.updatedAt))
    .limit(filtros.limite ?? 100);

  if (filas.length === 0) return [];

  const ids = filas.map((f) => f.post.id);

  const destinos = await db
    .select({
      postId: postTargets.postId,
      plataforma: postTargets.plataforma,
      estado: postTargets.estado,
      permalink: postTargets.permalink,
      nombreCuenta: socialAccounts.nombreVisible,
    })
    .from(postTargets)
    .innerJoin(socialAccounts, eq(socialAccounts.id, postTargets.socialAccountId))
    .where(inArray(postTargets.postId, ids));

  const portadas = await db
    .select({
      postId: mediaAssets.postId,
      urlPublica: mediaAssets.urlPublica,
      thumbnailUrl: mediaAssets.thumbnailUrl,
      tipo: mediaAssets.tipo,
      orden: mediaAssets.orden,
    })
    .from(mediaAssets)
    .where(and(inArray(mediaAssets.postId, ids), eq(mediaAssets.orden, 0)));

  return filas.map((f) => ({
    ...f,
    destinos: destinos.filter((d) => d.postId === f.post.id),
    portada: portadas.find((p) => p.postId === f.post.id) ?? null,
  }));
}

/** Bandeja de aprobacion: lo mas proximo a publicarse primero. */
export async function listarParaRevision(brandId: string) {
  const pendientes = await listarPosts(brandId, { estados: ["EN_REVISION"] });

  return pendientes.sort((a, b) => {
    const fa = a.post.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const fb = b.post.scheduledAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (fa !== fb) return fa - fb;
    // Entre los que no tienen fecha, primero el que espera hace mas tiempo.
    return a.post.updatedAt.getTime() - b.post.updatedAt.getTime();
  });
}

export async function listarCuentas(brandId: string) {
  return db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.brandId, brandId), eq(socialAccounts.activo, true)))
    .orderBy(asc(socialAccounts.plataforma), asc(socialAccounts.nombreVisible));
}

export async function listarMiembros(brandId: string) {
  const { brandMembers } = await import("@/db/schema");
  return db
    .select({
      id: users.id,
      nombre: users.nombre,
      email: users.email,
      rol: brandMembers.rol,
    })
    .from(brandMembers)
    .innerJoin(users, eq(users.id, brandMembers.userId))
    .where(and(eq(brandMembers.brandId, brandId), eq(users.activo, true)))
    .orderBy(asc(users.nombre));
}
