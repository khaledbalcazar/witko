"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  boardCards,
  boardColumns,
  boards,
  cardChecklistItems,
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
 */

export interface Respuesta {
  ok: boolean;
  mensaje?: string;
  id?: string;
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

/* ------------------------------------------------------------------ */
/* Columnas                                                            */
/* ------------------------------------------------------------------ */

const columnaSchema = z.object({
  boardId: z.string().uuid(),
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

  const [creada] = await db
    .insert(boardColumns)
    .values({
      boardId: parseo.data.boardId,
      nombre: parseo.data.nombre,
      color: parseo.data.color,
      orden: (maximo ?? 0) + 1000,
    })
    .returning();

  revalidatePath("/tablero");
  return { ok: true, id: creada.id };
}

export async function renombrarColumna(
  columnaId: string,
  nombre: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const limpio = nombre.trim();
  if (!limpio) return { ok: false, mensaje: "El nombre no puede quedar vacio." };

  const filas = await db
    .select({ boardId: boardColumns.boardId })
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

  revalidatePath("/tablero");
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
  revalidatePath("/tablero");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tarjetas                                                            */
/* ------------------------------------------------------------------ */

const tarjetaSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  titulo: z.string().trim().min(1, "Ponele un titulo.").max(200),
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

  const [{ maximo }] = await db
    .select({ maximo: sql<number | null>`max(${boardCards.orden})` })
    .from(boardCards)
    .where(eq(boardCards.columnId, parseo.data.columnId));

  const [creada] = await db
    .insert(boardCards)
    .values({
      boardId: parseo.data.boardId,
      columnId: parseo.data.columnId,
      titulo: parseo.data.titulo,
      autorId: sesion.usuario.id,
      orden: (maximo ?? 0) + 1000,
    })
    .returning();

  revalidatePath("/tablero");
  return { ok: true, id: creada.id };
}

const edicionSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  descripcion: z.string().max(4000).nullable().optional(),
  asignadoId: z.string().uuid().nullable().optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  postId: z.string().uuid().nullable().optional(),
  etiquetaIds: z.array(z.string().uuid()).optional(),
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

  revalidatePath("/tablero");
  return { ok: true };
}

/** Mueve una tarjeta a otra columna o a otra posicion dentro de la misma. */
export async function moverTarjeta(params: {
  cardId: string;
  columnId: string;
  /** Ids de las tarjetas vecinas en el destino, en orden. */
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

  const anterior =
    vecinas.find((v) => v.id === params.anteriorId)?.orden ?? null;
  const siguiente =
    vecinas.find((v) => v.id === params.siguienteId)?.orden ?? null;

  await db
    .update(boardCards)
    .set({
      columnId: params.columnId,
      orden: ordenEntre(anterior, siguiente),
      updatedAt: new Date(),
    })
    .where(eq(boardCards.id, params.cardId));

  revalidatePath("/tablero");
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

  revalidatePath("/tablero");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Checklist y etiquetas                                               */
/* ------------------------------------------------------------------ */

export async function agregarItemChecklist(
  cardId: string,
  texto: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  const tarjeta = await tarjetaDeMiMarca(cardId, sesion.marcaActiva.id);
  if (!tarjeta) return { ok: false, mensaje: "No encontramos esa tarjeta." };

  const limpio = texto.trim();
  if (!limpio) return { ok: false, mensaje: "Escribi algo." };

  const [{ maximo }] = await db
    .select({ maximo: sql<number | null>`max(${cardChecklistItems.orden})` })
    .from(cardChecklistItems)
    .where(eq(cardChecklistItems.cardId, cardId));

  await db.insert(cardChecklistItems).values({
    cardId,
    texto: limpio,
    orden: (maximo ?? 0) + 1000,
  });

  revalidatePath("/tablero");
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

  revalidatePath("/tablero");
  return { ok: true };
}

export async function crearEtiqueta(
  boardId: string,
  nombre: string,
  color: string,
): Promise<Respuesta> {
  const sesion = await exigirSesion();
  if (!(await tableroDeMiMarca(boardId, sesion.marcaActiva.id))) {
    return { ok: false, mensaje: "Ese tablero no es de esta marca." };
  }

  const limpio = nombre.trim();
  if (!limpio) return { ok: false, mensaje: "Ponele un nombre." };

  const [creada] = await db
    .insert(cardLabels)
    .values({ boardId, nombre: limpio, color })
    .onConflictDoNothing()
    .returning();

  if (!creada) {
    return { ok: false, mensaje: "Ya existe una etiqueta con ese nombre." };
  }

  revalidatePath("/tablero");
  return { ok: true, id: creada.id };
}
