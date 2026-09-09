import "server-only";

/**
 * Rate limit por usuario, en memoria del proceso.
 * Alcanza para un equipo de marketing con una sola instancia; si algun dia hay
 * varias, esto se mueve a una tabla de Postgres.
 */

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 30;
const cubos = new Map<string, { desde: number; usados: number }>();

export function superaLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const cubo = cubos.get(usuarioId);

  if (!cubo || ahora - cubo.desde > VENTANA_MS) {
    cubos.set(usuarioId, { desde: ahora, usados: 1 });
    return false;
  }

  cubo.usados += 1;
  return cubo.usados > MAX_POR_VENTANA;
}
