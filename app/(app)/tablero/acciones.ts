"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  boardCards,
  boardColumns,
  boards,
  cardChecklistItems,
  cardComments,
  cardLabelLinks,
  cardLabels,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { exigirSesion } from "@/lib/auth/sesion";
import { ordenEntre } from "@/lib/queries/tablero";

/**
 * Acciones del tablero.
 *
 * El tablero es del equipo: cualquier miembro de la marca puede crear, mover y
 * editar tarjetas. No hay flujo de aprobacion aca; el que importa es el de las
 * publicaciones.
 *
 * Las creaciones aceptan un `id` generado en el navegador. Asi la interfaz
 * puede pintar la tarjeta nueva antes de que el servidor conteste, sin tener
 * que reconciliar despues un id provisorio con el definitivo.
 */

export interface Respuesta {
  ok: boolean;
  mensaje?: string;
}

/** Confirma que el tablero pertenece a la marca activa del usuario. */
async function tableroDeMiMarca(boardId: string, brandId: string) {
  const filas = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.brandId, brandId)))
    .limit(1);
  return filas[0] ?? null;
}

async function tarjetaDeMiMarca(cardId: string, brandId: string) {
  const filas = await db
    .select({ tarjeta: boardCards })
    .from(boardCards)
    .innerJoin(boards, eq(boards.id, boardCards.boardId))
    .where(and(eq(boardCards.id, cardId), eq(boards.brandId, brandId)))
    .limit(1);
  return filas[0]?.tarjeta ?? null;
}

const idSchema = z.string().uuid();

/* ------------------------------------------------------------------ */
/* Columnas                                                            */
/* ------------------------------------------------------------------ */

const columnaSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  nombre: z.string().trim().min(1, "Ponele un nombre.").max(60),
  color: z.string().max(20).nullable().default(null),
});

export async function crearColumna(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = columnaSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  if (!(await tableroDeMiMarca(parseo.data.boardId, sesion.marcaActiva.id))) {
    return { ok: false, mensaje: "Ese tablero no es de esta marca." };
  }

  const [{ maximo }] = await db
    .select({ maximo: sql<number | null>`max(${boardColumns.orden})` })
    .from(boardColumns)
    .where(eq(boardColumns.boardId, parseo.data.boardId));

  await db.insert(boardColumns).values({
    id: parseo.data.id,
    boardId: parseo.data.boardId,
    nombre: parseo.data.nombre,
    color: parseo.data.color,
    orden: (maximo ?? 0) + 1000,
  });

  return { ok: true };
}

export async function renombrarColumna(
  columnaId: string,
  nombre: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, mensaje: "El nombre no puede quedar vacio." };

  const filas = await db
    .select({ id: boardColumns.id })
    .from(boardColumns)
    .innerJoin(boards, eq(boards.id, boardColumns.boardId))
    .where(
      and(eq(boardColumns.id, columnaId), eq(boards.brandId, sesion.marcaActiva.id)),
    )
    .limit(1);

  if (filas.length === 0) {
    return { ok: false, mensaje: "No encontramos esa columna." };
  }

  await db
    .update(boardColumns)
    .set({ nombre: limpio })
    .where(eq(boardColumns.id, columnaId));

  return { ok: true };
}

export async function eliminarColumna(columnaId: string): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ id: boardColumns.id })
    .from(boardColumns)
    .innerJoin(boards, eq(boards.id, boardColumns.boardId))
    .where(
      and(eq(boardColumns.id, columnaId), eq(boards.brandId, sesion.marcaActiva.id)),
    )
    .limit(1);

  if (filas.length === 0) {
    return { ok: false, mensaje: "No encontramos esa columna." };
  }

  // Borrar una columna con tarjetas adentro las borraria en cascada, que es
  // justo lo que nadie espera al reordenar un tablero.
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(boardCards)
    .where(and(eq(boardCards.columnId, columnaId), isNull(boardCards.archivadoAt)));

  if (total > 0) {
    return {
      ok: false,
      mensaje:
        "La columna tiene " +
        total +
        (total === 1 ? " tarjeta" : " tarjetas") +
        ". Movelas antes de borrarla.",
    };
  }

  await db.delete(boardColumns).where(eq(boardColumns.id, columnaId));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tarjetas                                                            */
/* ------------------------------------------------------------------ */

const tarjetaSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  columnId: idSchema,
  titulo: z.string().trim().min(1, "Ponele un titulo.").max(200),
  orden: z.number(),
});

export async function crearTarjeta(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = tarjetaSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  if (!(await tableroDeMiMarca(parseo.data.boardId, sesion.marcaActiva.id))) {
    return { ok: false, mensaje: "Ese tablero no es de esta marca." };
  }

  await db.insert(boardCards).values({
    id: parseo.data.id,
    boardId: parseo.data.boardId,
    columnId: parseo.data.columnId,
    titulo: parseo.data.titulo,
    autorId: sesion.usuario.id,
    orden: parseo.data.orden,
  });

  return { ok: true };
}

const edicionSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  descripcion: z.string().max(4000).nullable().optional(),
  asignadoId: idSchema.nullable().optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  postId: idSchema.nullable().optional(),
  etiquetaIds: z.array(idSchema).optional(),
});

export async function editarTarjeta(
  cardId: string,
  datos: unknown,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const tarjeta = await tarjetaDeMiMarca(cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  const parseo = edicionSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const { etiquetaIds, ...campos } = parseo.data;

  await db.transaction(async (tx) => {
    if (Object.keys(campos).length > 0) {
      await tx
        .update(boardCards)
        .set({ ...campos, updatedAt: new Date() })
        .where(eq(boardCards.id, cardId));
    }

    if (etiquetaIds) {
      await tx.delete(cardLabelLinks).where(eq(cardLabelLinks.cardId, cardId));
      if (etiquetaIds.length > 0) {
        await tx
          .insert(cardLabelLinks)
          .values(etiquetaIds.map((labelId) => ({ cardId, labelId })));
      }
    }

    await registrarAuditoria(tx, {
      actorId: sesion.usuario.id,
      entidad: "board_card",
      entidadId: cardId,
      accion: "EDITAR",
      diff: parseo.data as Record<string, unknown>,
    });
  });

  return { ok: true };
}

/** Marca la tarea como hecha o la devuelve a pendiente. */
export async function completarTarjeta(
  cardId: string,
  hecha: boolean,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const tarjeta = await tarjetaDeMiMarca(cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  await db
    .update(boardCards)
    .set({ completadoAt: hecha ? new Date() : null, updatedAt: new Date() })
    .where(eq(boardCards.id, cardId));

  return { ok: true };
}

/** Mueve una tarjeta a otra columna o a otra posicion dentro de la misma. */
export async function moverTarjeta(params: {
  cardId: string;
  columnId: string;
  anteriorId: string | null;
  siguienteId: string | null;
}): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const tarjeta = await tarjetaDeMiMarca(params.cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  const vecinas = await db
    .select({ id: boardCards.id, orden: boardCards.orden })
    .from(boardCards)
    .where(eq(boardCards.columnId, params.columnId))
    .orderBy(asc(boardCards.orden));

  const anterior = vecinas.find((v) => v.id === params.anteriorId)?.orden ?? null;
  const siguiente = vecinas.find((v) => v.id === params.siguienteId)?.orden ?? null;

  await db
    .update(boardCards)
    .set({
      columnId: params.columnId,
      orden: ordenEntre(anterior, siguiente),
      updatedAt: new Date(),
    })
    .where(eq(boardCards.id, params.cardId));

  return { ok: true };
}

export async function archivarTarjeta(cardId: string): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const tarjeta = await tarjetaDeMiMarca(cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  await db
    .update(boardCards)
    .set({ archivadoAt: new Date() })
    .where(eq(boardCards.id, cardId));

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Checklist                                                           */
/* ------------------------------------------------------------------ */

const itemSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  texto: z.string().trim().min(1, "Escribi algo.").max(500),
});

export async function agregarItemChecklist(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = itemSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const tarjeta = await tarjetaDeMiMarca(parseo.data.cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  const [{ maximo }] = await db
    .select({ maximo: sql<number | null>`max(${cardChecklistItems.orden})` })
    .from(cardChecklistItems)
    .where(eq(cardChecklistItems.cardId, parseo.data.cardId));

  await db.insert(cardChecklistItems).values({
    id: parseo.data.id,
    cardId: parseo.data.cardId,
    texto: parseo.data.texto,
    orden: (maximo ?? 0) + 1000,
  });

  return { ok: true };
}

export async function marcarItemChecklist(
  itemId: string,
  hecho: boolean,
): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ id: cardChecklistItems.id })
    .from(cardChecklistItems)
    .innerJoin(boardCards, eq(boardCards.id, cardChecklistItems.cardId))
    .innerJoin(boards, eq(boards.id, boardCards.boardId))
    .where(
      and(
        eq(cardChecklistItems.id, itemId),
        eq(boards.brandId, sesion.marcaActiva.id),
      ),
    )
    .limit(1);

  if (filas.length === 0) return { ok: false, mensaje: "No encontramos el item." };

  await db
    .update(cardChecklistItems)
    .set({ hecho })
    .where(eq(cardChecklistItems.id, itemId));

  return { ok: true };
}

export async function eliminarItemChecklist(itemId: string): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ id: cardChecklistItems.id })
    .from(cardChecklistItems)
    .innerJoin(boardCards, eq(boardCards.id, cardChecklistItems.cardId))
    .innerJoin(boards, eq(boards.id, boardCards.boardId))
    .where(
      and(
        eq(cardChecklistItems.id, itemId),
        eq(boards.brandId, sesion.marcaActiva.id),
      ),
    )
    .limit(1);

  if (filas.length === 0) return { ok: false, mensaje: "No encontramos el item." };

  await db.delete(cardChecklistItems).where(eq(cardChecklistItems.id, itemId));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Comentarios                                                         */
/* ------------------------------------------------------------------ */

const comentarioSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  cuerpo: z.string().trim().min(1, "Escribi algo.").max(4000),
});

export async function comentarTarjeta(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = comentarioSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  const tarjeta = await tarjetaDeMiMarca(parseo.data.cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  await db.insert(cardComments).values({
    id: parseo.data.id,
    cardId: parseo.data.cardId,
    autorId: sesion.usuario.id,
    cuerpo: parseo.data.cuerpo,
  });

  return { ok: true };
}

export async function eliminarComentario(comentarioId: string): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ autorId: cardComments.autorId })
    .from(cardComments)
    .innerJoin(boardCards, eq(boardCards.id, cardComments.cardId))
    .innerJoin(boards, eq(boards.id, boardCards.boardId))
    .where(
      and(
        eq(cardComments.id, comentarioId),
        eq(boards.brandId, sesion.marcaActiva.id),
      ),
    )
    .limit(1);

  const comentario = filas[0];
  if (!comentario) return { ok: false, mensaje: "No encontramos el comentario." };

  // Cada uno borra lo suyo; el admin puede borrar cualquiera.
  if (
    comentario.autorId !== sesion.usuario.id &&
    sesion.usuario.rol !== "ADMIN"
  ) {
    return { ok: false, mensaje: "Solo podes borrar tus propios comentarios." };
  }

  await db.delete(cardComments).where(eq(cardComments.id, comentarioId));
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Etiquetas                                                           */
/* ------------------------------------------------------------------ */

const etiquetaSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  nombre: z.string().trim().min(1, "Ponele un nombre.").max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color tiene que ser hexadecimal."),
});

export async function crearEtiqueta(datos: unknown): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const parseo = etiquetaSchema.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, mensaje: parseo.error.issues[0].message };
  }

  if (!(await tableroDeMiMarca(parseo.data.boardId, sesion.marcaActiva.id))) {
    return { ok: false, mensaje: "Ese tablero no es de esta marca." };
  }

  const creada = await db
    .insert(cardLabels)
    .values({
      id: parseo.data.id,
      boardId: parseo.data.boardId,
      nombre: parseo.data.nombre,
      color: parseo.data.color,
    })
    .onConflictDoNothing()
    .returning();

  if (creada.length === 0) {
    return { ok: false, mensaje: "Ya existe una etiqueta con ese nombre." };
  }

  return { ok: true };
}

export async function editarEtiqueta(
  etiquetaId: string,
  nombre: string,
  color: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ id: cardLabels.id })
    .from(cardLabels)
    .innerJoin(boards, eq(boards.id, cardLabels.boardId))
    .where(
      and(eq(cardLabels.id, etiquetaId), eq(boards.brandId, sesion.marcaActiva.id)),
    )
    .limit(1);

  if (filas.length === 0) return { ok: false, mensaje: "No encontramos la etiqueta." };

  const limpio = nombre.trim();
  if (!limpio) return { ok: false, mensaje: "Ponele un nombre." };

  await db
    .update(cardLabels)
    .set({ nombre: limpio, color })
    .where(eq(cardLabels.id, etiquetaId));

  return { ok: true };
}

export async function eliminarEtiqueta(etiquetaId: string): Promise<Respuesta> {
  const sesion = await exigirSesion();

  const filas = await db
    .select({ id: cardLabels.id })
    .from(cardLabels)
    .innerJoin(boards, eq(boards.id, cardLabels.boardId))
    .where(
      and(eq(cardLabels.id, etiquetaId), eq(boards.brandId, sesion.marcaActiva.id)),
    )
    .limit(1);

  if (filas.length === 0) return { ok: false, mensaje: "No encontramos la etiqueta." };

  await db.delete(cardLabels).where(eq(cardLabels.id, etiquetaId));
  return { ok: true };
}
