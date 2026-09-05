import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Aplica las migraciones de Drizzle y despues las politicas de RLS, que se
 * escriben a mano porque drizzle-kit no las genera.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);

  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./db/migrations" });

  const carpetaPoliticas = path.join(process.cwd(), "db", "policies");
  const archivos = readdirSync(carpetaPoliticas)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const archivo of archivos) {
    console.log("Aplicando politicas: " + archivo);
    const contenido = readFileSync(path.join(carpetaPoliticas, archivo), "utf8");
    await sql.unsafe(contenido);
  }

  await sql.end();
  console.log("Listo.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
