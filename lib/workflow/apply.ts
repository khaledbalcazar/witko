import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  approvals,
  brandMembers,
  brands,
  comments,
  postTargets,
  posts,
  publishJobs,
  users,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { notifier } from "@/lib/notifications/notifier";
import { evaluarTransicion } from "./state-machine";
import type {
  AccionWorkflow,
  Actor,
  ResultadoTransicion,
  Rol,
} from "./types";

/**
 * Unico camino para cambiar el estado de un post.
 *
 * Carga el post y la marca, evalua la transicion con la maquina de estados y,
 * si pasa, aplica todo en una sola transaccion: el nuevo estado, la fila de
 * aprobacion, la cola de publicacion y el registro de auditoria. Las
 * notificaciones se mandan despues del commit, porque un email que falla no
 * tiene que deshacer una aprobacion.
 */

export interface PedidoTransicion {
  postId: string;
  accion: AccionWorkflow;
  usuarioId: string;
  comentario?: string | null;
  scheduledAt?: Date | null;
  /** Inyectable para los tests. */
  ahora?: Date;
}

export type ResultadoAplicacion =
  | { ok: true; nuevoEstado: string }
  | { ok: false; codigo: string; motivo: string };

export async function aplicarTransicion(
  pedido: PedidoTransicion,
): Promise<ResultadoAplicacion> {
  const ahora = pedido.ahora ?? new Date();

  const filas = await db
    .select({
      post: posts,
      marca: brands,
      autor: { id: users.id, nombre: users.nombre, email: users.email },
    })
    .from(posts)
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .innerJoin(users, eq(users.id, posts.autorId))
    .where(eq(posts.id, pedido.postId))
    .limit(1);

  if (filas.length === 0) {
    return { ok: false, codigo: "NO_ENCONTRADO", motivo: "El post no existe." };
  }

  const { post, marca, autor } = filas[0];
  const actor = await construirActor(pedido.usuarioId, post.brandId);

  if (!actor) {
    return {
      ok: false,
      codigo: "NO_ENCONTRADO",
      motivo: "El usuario no existe o esta inactivo.",
    };
  }

  const decision = evaluarTransicion({
    accion: pedido.accion,
    post: {
      id: post.id,
      estado: post.estado,
      autorId: post.autorId,
      brandId: post.brandId,
      version: post.version,
      scheduledAt: post.scheduledAt,
      archivadoAt: post.archivadoAt,
    },
    marca: {
      id: marca.id,
      permitirAutoAprobacion: marca.permitirAutoAprobacion,
    },
    actor,
    comentario: pedido.comentario,
    scheduledAt: pedido.scheduledAt,
    ahora,
  });

  if (!decision.ok) {
    return { ok: false, codigo: decision.codigo, motivo: decision.motivo };
  }

  await persistir(pedido, decision, ahora, post.version);
  await notificar(pedido, decision, autor, post.tituloInterno);

  return { ok: true, nuevoEstado: decision.nuevoEstado };
}

async function construirActor(
  usuarioId: string,
  brandId: string,
): Promise<Actor | null> {
  const filas = await db
    .select({ rol: users.rol, activo: users.activo, esMiembro: brandMembers.userId })
    .from(users)
    .leftJoin(
      brandMembers,
      and(eq(brandMembers.userId, users.id), eq(brandMembers.brandId, brandId)),
    )
    .where(eq(users.id, usuarioId))
    .limit(1);

  if (filas.length === 0 || !filas[0].activo) return null;

  return {
    tipo: "USUARIO",
    id: usuarioId,
    rol: filas[0].rol as Rol,
    esMiembro: filas[0].esMiembro != null,
  };
}

async function persistir(
  pedido: PedidoTransicion,
  decision: Extract<ResultadoTransicion, { ok: true }>,
  ahora: Date,
  versionActual: number,
): Promise<void> {
  const { efectos } = decision;

  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({
        estado: decision.nuevoEstado,
        updatedAt: ahora,
        ...(efectos.incrementarVersion ? { version: versionActual + 1 } : {}),
        ...(pedido.scheduledAt !== undefined && pedido.scheduledAt !== null
          ? { scheduledAt: pedido.scheduledAt }
          : {}),
        ...(efectos.sellarPublicacion ? { publishedAt: ahora } : {}),
        ...(efectos.archivar ? { archivadoAt: ahora } : {}),
      })
      .where(eq(posts.id, pedido.postId));

    if (efectos.registrarAprobacion) {
      await tx.insert(approvals).values({
        postId: pedido.postId,
        revisorId: pedido.usuarioId,
        accion: efectos.registrarAprobacion,
        comentario: pedido.comentario ?? null,
        postVersion: versionActual,
      });

      // El comentario del revisor tambien va al hilo, para que el CM lo lea
      // donde lee todo lo demas.
      if (pedido.comentario?.trim()) {
        await tx.insert(comments).values({
          postId: pedido.postId,
          autorId: pedido.usuarioId,
          cuerpo: pedido.comentario.trim(),
        });
      }
    }

    if (efectos.cancelarJobs) {
      // Solo los que todavia no tomo el worker. Un job EN_CURSO lo cierra el
      // worker, que antes de llamar a la API vuelve a mirar el estado del post.
      await tx
        .delete(publishJobs)
        .where(
          and(
            eq(publishJobs.estado, "PENDIENTE"),
            inArray(
              publishJobs.postTargetId,
              tx
                .select({ id: postTargets.id })
                .from(postTargets)
                .where(eq(postTargets.postId, pedido.postId)),
            ),
          ),
        );
    }

    if (efectos.encolarJobs) {
      const destinos = await tx
        .select({ id: postTargets.id })
        .from(postTargets)
        .where(
          and(
            eq(postTargets.postId, pedido.postId),
            inArray(postTargets.estado, ["PENDIENTE", "FALLIDO"]),
          ),
        );

      const runAt = pedido.scheduledAt ?? ahora;

      for (const destino of destinos) {
        // Un destino puede tener un job viejo en ERROR: el indice unico parcial
        // solo cubre PENDIENTE y EN_CURSO, asi que insertar es seguro.
        await tx.insert(publishJobs).values({
          postTargetId: destino.id,
          runAt,
          estado: "PENDIENTE",
          intentos: 0,
        });

        await tx
          .update(postTargets)
          .set({ estado: "PENDIENTE", errorMensaje: null, errorCode: null })
          .where(eq(postTargets.id, destino.id));
      }
    }

    if (decision.nuevoEstado === "CANCELADO") {
      await tx
        .update(postTargets)
        .set({ estado: "CANCELADO" })
        .where(
          and(
            eq(postTargets.postId, pedido.postId),
            inArray(postTargets.estado, ["PENDIENTE", "FALLIDO"]),
          ),
        );
    }

    await registrarAuditoria(tx, {
      actorId: pedido.usuarioId,
      entidad: "post",
      entidadId: pedido.postId,
      accion: pedido.accion,
      diff: {
        estado: { antes: decision.estadoAnterior, despues: decision.nuevoEstado },
        ...(efectos.incrementarVersion
          ? { version: { antes: versionActual, despues: versionActual + 1 } }
          : {}),
        ...(pedido.comentario ? { comentario: pedido.comentario } : {}),
        ...(pedido.scheduledAt
          ? { scheduledAt: pedido.scheduledAt.toISOString() }
          : {}),
      },
    });
  });
}

async function notificar(
  pedido: PedidoTransicion,
  decision: Extract<ResultadoTransicion, { ok: true }>,
  autor: { id: string; nombre: string; email: string },
  titulo: string,
): Promise<void> {
  if (!decision.efectos.notificarAutor) return;
  // No tiene sentido avisarle a alguien de lo que acaba de hacer.
  if (autor.id === pedido.usuarioId) return;

  const enlace = "/posts/" + pedido.postId;

  const plantillas: Partial<
    Record<string, { tipo: "POST_APROBADO" | "POST_DEVUELTO"; asunto: string; cuerpo: string }>
  > = {
    APROBAR: {
      tipo: "POST_APROBADO",
      asunto: 'Aprobaron tu publicacion "' + titulo + '"',
      cuerpo: "Ya podes programarla o publicarla.",
    },
    SOLICITAR_CAMBIOS: {
      tipo: "POST_DEVUELTO",
      asunto: 'Te devolvieron la publicacion "' + titulo + '"',
      cuerpo: pedido.comentario?.trim() || "Revisa los comentarios en el post.",
    },
  };

  const plantilla = plantillas[pedido.accion];
  if (!plantilla) return;

  try {
    await notifier().enviar({
      tipo: plantilla.tipo,
      para: autor.email,
      nombreDestinatario: autor.nombre,
      asunto: plantilla.asunto,
      cuerpo: plantilla.cuerpo,
      enlace,
    });
  } catch (error) {
    // Un email caido no puede deshacer una aprobacion que ya se guardo.
    console.error("No se pudo notificar al autor:", error);
  }
}

/** Marca el post segun como terminaron sus destinos. La usa el worker. */
export async function reconciliarEstadoDelPost(
  postId: string,
  ahora = new Date(),
): Promise<"PUBLICADO" | "FALLIDO" | "PUBLICANDO"> {
  const destinos = await db
    .select({ estado: postTargets.estado })
    .from(postTargets)
    .where(eq(postTargets.postId, postId));

  const activos = destinos.filter((d) => d.estado !== "CANCELADO");
  const terminados = activos.every(
    (d) => d.estado === "PUBLICADO" || d.estado === "FALLIDO",
  );

  if (!terminados) return "PUBLICANDO";

  // Basta que uno falle para que el post quede FALLIDO: el CM tiene que verlo.
  const huboFallo = activos.some((d) => d.estado === "FALLIDO");
  const nuevoEstado = huboFallo ? "FALLIDO" : "PUBLICADO";

  await db
    .update(posts)
    .set({
      estado: nuevoEstado,
      updatedAt: ahora,
      ...(nuevoEstado === "PUBLICADO" ? { publishedAt: ahora } : {}),
    })
    .where(and(eq(posts.id, postId), eq(posts.estado, "PUBLICANDO")));

  await registrarAuditoria(db, {
    actorId: null,
    entidad: "post",
    entidadId: postId,
    accion: huboFallo ? "MARCAR_FALLIDO" : "MARCAR_PUBLICADO",
    diff: { estado: { antes: "PUBLICANDO", despues: nuevoEstado } },
  });

  return nuevoEstado;
}

/** Cuenta cuantos posts esperan revision, para el badge de la bandeja. */
export async function contarPendientesDeRevision(
  brandId: string,
): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.brandId, brandId), eq(posts.estado, "EN_REVISION")));
  return fila?.total ?? 0;
}
