import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` no necesita una base viva; solo `push` y `studio` la
// usan de verdad. El placeholder deja generar migraciones sin entorno cargado.
const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
