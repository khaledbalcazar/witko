import { auditLog } from "@/db/schema";
import type { Db } from "@/db/client";

/**
 * Registro de auditoria. Toda transicion de estado y toda edicion de contenido
 * pasa por aca, dentro de la misma transaccion que el cambio: si falla el
 * registro, no queda el cambio sin rastro.
 */

export type Entidad =
  | "post"
  | "post_target"
  | "social_account"
  | "brand"
  | "user"
  | "board_card";

export interface EntradaAuditoria {
  actorId: string | null;
  entidad: Entidad;
  entidadId: string;
  accion: string;
  diff?: Record<string, unknown>;
}

type Ejecutor = Pick<Db, "insert">;

export async function registrarAuditoria(
  ejecutor: Ejecutor,
  entrada: EntradaAuditoria,
): Promise<void> {
  await ejecutor.insert(auditLog).values({
    actorId: entrada.actorId,
    entidad: entrada.entidad,
    entidadId: entrada.entidadId,
    accion: entrada.accion,
    diff: entrada.diff ?? null,
  });
}

/**
 * Diff campo por campo entre dos versiones de un registro, para guardar solo
 * lo que cambio en vez del objeto entero.
 */
export function calcularDiff(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
): Record<string, { antes: unknown; despues: unknown }> {
  const diff: Record<string, { antes: unknown; despues: unknown }> = {};
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);

  for (const clave of claves) {
    const a = antes[clave];
    const d = despues[clave];
    if (!equivalentes(a, d)) {
      diff[clave] = { antes: a, despues: d };
    }
  }

  return diff;
}

function equivalentes(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
