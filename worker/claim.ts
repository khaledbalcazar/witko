import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { limiteJobTrabado } from "./backoff";

/**
 * Toma de trabajos de la cola.
 *
 * `FOR UPDATE SKIP LOCKED` hace que dos workers corriendo al mismo tiempo nunca
 * agarren el mismo job: el segundo simplemente saltea la fila bloqueada. Es la
 * misma garantia que da una cola externa, sin agregar una cola externa.
 */

export interface JobTomado {
  id: string;
  postTargetId: string;
  intentos: number;
  maxIntentos: number;
  runAt: Date;
}

export async function tomarJobs(
  workerId: string,
  limite = 10,
  ahora = new Date(),
): Promise<JobTomado[]> {
  const filas = await db.execute<{
    id: string;
    post_target_id: string;
    intentos: number;
    max_intentos: number;
    run_at: Date;
  }>(sql`
    with candidatos as (
      select id
      from publish_jobs
      where estado = 'PENDIENTE' and run_at <= ${ahora}
      order by run_at
      for update skip locked
      limit ${limite}
    )
    update publish_jobs j
    set estado = 'EN_CURSO',
        locked_at = ${ahora},
        locked_by = ${workerId},
        intentos = j.intentos + 1,
        updated_at = ${ahora}
    from candidatos c
    where j.id = c.id
    returning j.id, j.post_target_id, j.intentos, j.max_intentos, j.run_at
  `);

  return filas.map((f) => ({
    id: f.id,
    postTargetId: f.post_target_id,
    intentos: f.intentos,
    maxIntentos: f.max_intentos,
    runAt: f.run_at,
  }));
}

/**
 * Devuelve a la cola los jobs que quedaron EN_CURSO mas de 15 minutos.
 * Pasa cuando el worker muere en medio de una publicacion. El intento ya quedo
 * contado, asi que un job que se traba tres veces igual termina en ERROR.
 */
export async function liberarJobsTrabados(ahora = new Date()): Promise<number> {
  const filas = await db.execute<{ id: string }>(sql`
    update publish_jobs
    set estado = 'PENDIENTE',
        locked_at = null,
        locked_by = null,
        ultimo_error = 'El intento anterior quedo sin terminar y se reprogramo.',
        updated_at = ${ahora}
    where estado = 'EN_CURSO'
      and locked_at < ${limiteJobTrabado(ahora)}
    returning id
  `);

  return filas.length;
}
