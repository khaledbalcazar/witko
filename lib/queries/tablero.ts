import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  boardCards,
  boardColumns,
  boards,
  cardChecklistItems,
  cardComments,
  cardLabelLinks,
  cardLabels,
  posts,
  users,
} from "@/db/schema";

/** Lecturas del tablero de tareas. */

export async function obtenerTablero(brandId: string) {
  const existentes = await db
    .select()
    .from(boards)
    .where(and(eq(boards.brandId, brandId), isNull(boards.archivadoAt)))
    .orderBy(asc(boards.createdAt))
    .limit(1);

  const tablero = existentes[0];
  if (!tablero) return null;

  const columnas = await db
    .select()
    .from(boardColumns)
    .where(eq(boardColumns.boardId, tablero.id))
    .orderBy(asc(boardColumns.orden));

  const tarjetas = await db
    .select({
      tarjeta: boardCards,
      asignado: { id: users.id, nombre: users.nombre },
      post: { id: posts.id, titulo: posts.tituloInterno, estado: posts.estado },
    })
    .from(boardCards)
    .leftJoin(users, eq(users.id, boardCards.asignadoId))
    .leftJoin(posts, eq(posts.id, boardCards.postId))
    .where(and(eq(boardCards.boardId, tablero.id), isNull(boardCards.archivadoAt)))
    .orderBy(asc(boardCards.orden));

  const etiquetas = await db
    .select()
    .from(cardLabels)
    .where(eq(cardLabels.boardId, tablero.id))
    .orderBy(asc(cardLabels.nombre));

  const vinculos = await db
    .select()
    .from(cardLabelLinks)
    .innerJoin(boardCards, eq(boardCards.id, cardLabelLinks.cardId))
    .where(eq(boardCards.boardId, tablero.id));

  const checklists = await db
    .select()
    .from(cardChecklistItems)
    .innerJoin(boardCards, eq(boardCards.id, cardChecklistItems.cardId))
    .where(eq(boardCards.boardId, tablero.id))
    .orderBy(asc(cardChecklistItems.orden));

  const comentarios = await db
    .select({
      comentario: cardComments,
      autor: { id: users.id, nombre: users.nombre },
    })
    .from(cardComments)
    .innerJoin(boardCards, eq(boardCards.id, cardComments.cardId))
    .innerJoin(users, eq(users.id, cardComments.autorId))
    .where(eq(boardCards.boardId, tablero.id))
    .orderBy(asc(cardComments.createdAt));

  return {
    tablero,
    columnas,
    etiquetas,
    tarjetas: tarjetas.map((t) => ({
      ...t.tarjeta,
      asignado: t.asignado?.id ? t.asignado : null,
      post: t.post?.id ? t.post : null,
      etiquetaIds: vinculos
        .filter((v) => v.card_label_links.cardId === t.tarjeta.id)
        .map((v) => v.card_label_links.labelId),
      checklist: checklists
        .filter((c) => c.card_checklist_items.cardId === t.tarjeta.id)
        .map((c) => c.card_checklist_items),
      comentarios: comentarios
        .filter((c) => c.comentario.cardId === t.tarjeta.id)
        .map((c) => ({
          id: c.comentario.id,
          cuerpo: c.comentario.cuerpo,
          autorId: c.autor.id,
          autorNombre: c.autor.nombre,
          createdAt: c.comentario.createdAt,
        })),
    })),
  };
}

/**
 * Orden fraccional: al soltar una tarjeta se calcula el punto medio entre sus
 * vecinos, asi se actualiza una sola fila en vez de renumerar la columna.
 */
export function ordenEntre(anterior: number | null, siguiente: number | null): number {
  if (anterior == null && siguiente == null) return 1000;
  if (anterior == null) return siguiente! - 1000;
  if (siguiente == null) return anterior + 1000;
  return (anterior + siguiente) / 2;
}
