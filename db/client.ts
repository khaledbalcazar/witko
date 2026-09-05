import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function urlDeBase(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL en el entorno.");
  }
  return url;
}

/**
 * Una sola conexion por proceso. En dev, Next recarga los modulos en cada
 * cambio; sin este cache se abriria un pool nuevo por recarga hasta agotar las
 * conexiones de Supabase.
 */
const cache = globalThis as unknown as {
  __sqlWitko?: ReturnType<typeof postgres>;
};

const sql =
  cache.__sqlWitko ??
  postgres(urlDeBase(), {
    max: process.env.WORKER_ID ? 5 : 10,
    prepare: false, // el pooler de Supabase en modo transaction no soporta prepared statements
  });

if (process.env.NODE_ENV !== "production") {
  cache.__sqlWitko = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
export type Db = typeof db;
