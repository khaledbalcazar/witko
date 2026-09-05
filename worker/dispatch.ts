import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  brands,
  mediaAssets,
  mediaTags,
  postTargets,
  posts,
  publishJobs,
  socialAccounts,
  users,
} from "@/db/schema";
import { descifrarToken } from "@/lib/crypto/tokens";
import { notifier } from "@/lib/notifications/notifier";
import { adaptadorDe } from "@/lib/platforms/registry";
import type {
  ConfigDestino,
  DestinoParaPublicar,
  MediaParaPublicar,
} from "@/lib/platforms/types";
import { reconciliarEstadoDelPost } from "@/lib/workflow/apply";
import { registrarAuditoria } from "@/lib/audit";
import { decidirReintento } from "./backoff";
import type { JobTomado } from "./claim";

/**
 * Procesa un job: arma el destino, chequea cuota, publica y guarda el
 * resultado. Cada paso deja rastro en la base para que un reinicio del worker
 * pueda retomar sin publicar dos veces.
 */

export async function procesarJob(
  job: JobTomado,
  ahora = new Date(),
): Promise<"OK" | "REPROGRAMADO" | "ERROR" | "OMITIDO"> {
  const contexto = await cargarContexto(job.postTargetId);

  if (!contexto) {
    await cerrarJob(job.id, "ERROR", "El destino ya no existe.", ahora);
    return "ERROR";
  }

  const { destino, media, post, autor } = contexto;

  // Idempotencia, primera red: si ya se publico, el job termina sin llamar a
  // la API. Cubre el caso de un worker que muere despues de publicar pero
  // antes de guardar el resultado.
  if (destino.externalMediaId) {
    await cerrarJob(job.id, "OK", null, ahora);
    await reconciliarEstadoDelPost(destino.postId, ahora);
    return "OK";
  }

  // El post pudo haberse cancelado mientras el job esperaba en la cola.
  if (post.estado === "CANCELADO" || post.archivadoAt) {
    await db
      .update(postTargets)
      .set({ estado: "CANCELADO" })
      .where(eq(postTargets.id, destino.id));
    await cerrarJob(job.id, "OK", "El post se cancelo antes de publicarse.", ahora);
    return "OMITIDO";
  }

  const adaptador = adaptadorDe(destino.plataforma);

  // Sin cuota se reprograma, no se falla: el post sigue vivo y sale mas tarde.
  const cuota = await adaptador.checkQuota(destino.cuenta);
  if (!cuota.disponible) {
    const cuando =
      cuota.reintentarDespuesDe ?? new Date(ahora.getTime() + 30 * 60_000);
    await reprogramar(job.id, cuando, cuota.motivo ?? "Sin cuota disponible.", ahora);
    return "REPROGRAMADO";
  }

  await db
    .update(postTargets)
    .set({ estado: "PUBLICANDO" })
    .where(eq(postTargets.id, destino.id));

  const resultado = await adaptador.publish(destino, media, {
    guardarContainer: async (destinoId, containerId) => {
      await db
        .update(postTargets)
        .set({ externalContainerId: containerId })
        .where(eq(postTargets.id, destinoId));
    },
  });

  if (resultado.ok) {
    await db
      .update(postTargets)
      .set({
        estado: "PUBLICADO",
        externalMediaId: resultado.externalMediaId,
        permalink: resultado.permalink,
        publishedAt: ahora,
        errorMensaje: resultado.advertencia ?? null,
        errorCode: null,
      })
      .where(eq(postTargets.id, destino.id));

    await cerrarJob(job.id, "OK", null, ahora);

    await registrarAuditoria(db, {
      actorId: null,
      entidad: "post_target",
      entidadId: destino.id,
      accion: "PUBLICAR",
      diff: {
        plataforma: destino.plataforma,
        externalMediaId: resultado.externalMediaId,
        permalink: resultado.permalink,
      },
    });

    const estadoPost = await reconciliarEstadoDelPost(destino.postId, ahora);
    if (estadoPost === "PUBLICADO") {
      await avisar(
        autor,
        "POST_PUBLICADO",
        'Se publico "' + post.tituloInterno + '"',
        resultado.advertencia ?? "Ya esta arriba en todas las cuentas elegidas.",
        destino.postId,
      );
    }
    return "OK";
  }

  const decision = decidirReintento({
    intentosRealizados: job.intentos,
    maxIntentos: job.maxIntentos,
    reintentable: resultado.reintentable,
    ahora,
    reintentarDespuesDe: resultado.reintentarDespuesDe ?? null,
  });

  if (decision.reintentar && decision.proximoIntentoEn) {
    await db
      .update(postTargets)
      .set({
        estado: "PENDIENTE",
        errorMensaje: resultado.mensaje,
        errorCode: resultado.codigo,
      })
      .where(eq(postTargets.id, destino.id));

    await reprogramar(
      job.id,
      decision.proximoIntentoEn,
      resultado.mensaje,
      ahora,
    );
    return "REPROGRAMADO";
  }

  await db
    .update(postTargets)
    .set({
      estado: "FALLIDO",
      errorMensaje: resultado.mensaje,
      errorCode: resultado.codigo,
    })
    .where(eq(postTargets.id, destino.id));

  await cerrarJob(job.id, "ERROR", resultado.mensaje, ahora);
  await reconciliarEstadoDelPost(destino.postId, ahora);

  await avisar(
    autor,
    "POST_FALLIDO",
    'No se pudo publicar "' + post.tituloInterno + '"',
    resultado.mensaje,
    destino.postId,
  );

  return "ERROR";
}

/* ------------------------------------------------------------------ */

async function cargarContexto(postTargetId: string) {
  const filas = await db
    .select({
      target: postTargets,
      post: posts,
      cuenta: socialAccounts,
      marca: brands,
      autor: { id: users.id, nombre: users.nombre, email: users.email },
    })
    .from(postTargets)
    .innerJoin(posts, eq(posts.id, postTargets.postId))
    .innerJoin(socialAccounts, eq(socialAccounts.id, postTargets.socialAccountId))
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .innerJoin(users, eq(users.id, posts.autorId))
    .where(eq(postTargets.id, postTargetId))
    .limit(1);

  if (filas.length === 0) return null;

  const { target, post, cuenta, marca, autor } = filas[0];

  const assets = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.postId, post.id))
    .orderBy(asc(mediaAssets.orden));

  const etiquetas = await db
    .select()
    .from(mediaTags)
    .where(eq(mediaTags.postTargetId, target.id));

  const media: MediaParaPublicar[] = assets.map((a) => ({
    id: a.id,
    orden: a.orden,
    tipo: a.tipo,
    urlPublica: a.urlPublica,
    mime: a.mime,
    bytes: a.bytes,
    ancho: a.ancho,
    alto: a.alto,
    duracionMs: a.duracionMs,
    etiquetas: etiquetas
      .filter((e) => e.mediaAssetId === a.id)
      .map((e) => ({
        username: e.username,
        x: e.x != null ? Number(e.x) : null,
        y: e.y != null ? Number(e.y) : null,
      })),
  }));

  const config = (target.config ?? {}) as ConfigDestino;

  // El modo de TikTok lo manda la marca, no el post: es una decision de
  // cumplimiento, no de contenido.
  if (target.plataforma === "TIKTOK") {
    config.tiktok = { ...config.tiktok, modo: marca.modoTiktok };
  }

  const destino: DestinoParaPublicar = {
    id: target.id,
    postId: post.id,
    tipo: post.tipo,
    plataforma: target.plataforma,
    cuenta: {
      id: cuenta.id,
      brandId: cuenta.brandId,
      plataforma: cuenta.plataforma,
      externalAccountId: cuenta.externalAccountId,
      nombreVisible: cuenta.nombreVisible,
      accessToken: cuenta.accessTokenCifrado
        ? descifrarToken(cuenta.accessTokenCifrado)
        : null,
      refreshToken: cuenta.refreshTokenCifrado
        ? descifrarToken(cuenta.refreshTokenCifrado)
        : null,
      expiraEn: cuenta.expiraEn,
      metadata: cuenta.metadata,
    },
    caption: target.caption,
    primerComentario: target.primerComentario,
    altText: target.altText,
    isAiGenerated: target.isAiGenerated,
    locationId: target.locationId,
    config,
    externalContainerId: target.externalContainerId,
    externalMediaId: target.externalMediaId,
  };

  return { destino, media, post, autor };
}

async function cerrarJob(
  jobId: string,
  estado: "OK" | "ERROR",
  mensaje: string | null,
  ahora: Date,
): Promise<void> {
  await db
    .update(publishJobs)
    .set({
      estado,
      ultimoError: mensaje,
      lockedAt: null,
      lockedBy: null,
      updatedAt: ahora,
    })
    .where(eq(publishJobs.id, jobId));
}

async function reprogramar(
  jobId: string,
  cuando: Date,
  motivo: string,
  ahora: Date,
): Promise<void> {
  await db
    .update(publishJobs)
    .set({
      estado: "PENDIENTE",
      runAt: cuando,
      ultimoError: motivo,
      lockedAt: null,
      lockedBy: null,
      updatedAt: ahora,
    })
    .where(eq(publishJobs.id, jobId));
}

async function avisar(
  autor: { nombre: string; email: string },
  tipo: "POST_PUBLICADO" | "POST_FALLIDO",
  asunto: string,
  cuerpo: string,
  postId: string,
): Promise<void> {
  try {
    await notifier().enviar({
      tipo,
      para: autor.email,
      nombreDestinatario: autor.nombre,
      asunto,
      cuerpo,
      enlace: "/posts/" + postId,
    });
  } catch (error) {
    console.error("No se pudo notificar:", error);
  }
}

/** Cuenta los jobs pendientes, para el log del ciclo. */
export async function hayTrabajoPendiente(ahora = new Date()): Promise<boolean> {
  const filas = await db
    .select({ id: publishJobs.id })
    .from(publishJobs)
    .where(and(eq(publishJobs.estado, "PENDIENTE")))
    .limit(1);
  return filas.length > 0;
}
