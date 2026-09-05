import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { boardColumns, boards, brands, cardLabels } from "./schema";

/**
 * Crea las dos marcas de la empresa con su tablero de tareas.
 * Es idempotente: se puede correr las veces que haga falta.
 *
 * No crea usuarios: el primer admin se crea a mano desde el panel de Supabase
 * (ver SETUP.md, paso 6) porque las contrasenas no se pueden setear por SQL.
 */

const MARCAS = [
  { nombre: "Witko", slug: "witko" },
  { nombre: "Palma Travel", slug: "palma-travel" },
];

const COLUMNAS = [
  { nombre: "Ideas", orden: 1000, color: "#94a3b8" },
  { nombre: "En produccion", orden: 2000, color: "#3b82f6" },
  { nombre: "Esperando aprobacion", orden: 3000, color: "#f59e0b" },
  { nombre: "Listo para publicar", orden: 4000, color: "#10b981" },
  { nombre: "Publicado", orden: 5000, color: "#6b7280" },
];

const ETIQUETAS = [
  { nombre: "Campana", color: "#ec4899" },
  { nombre: "Contenido organico", color: "#8b5cf6" },
  { nombre: "Urgente", color: "#ef4444" },
  { nombre: "Necesita diseno", color: "#f59e0b" },
  { nombre: "Necesita foto", color: "#06b6d4" },
];

async function main() {
  for (const marca of MARCAS) {
    const existente = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, marca.slug))
      .limit(1);

    let brandId: string;

    if (existente.length > 0) {
      brandId = existente[0].id;
      console.log("Marca ya existente: " + marca.nombre);
    } else {
      const [creada] = await db
        .insert(brands)
        .values({
          nombre: marca.nombre,
          slug: marca.slug,
          timezone: "America/Asuncion",
          permitirAutoAprobacion: false,
          modoTiktok: "MEDIA_UPLOAD",
        })
        .returning();
      brandId = creada.id;
      console.log("Marca creada: " + marca.nombre);
    }

    const tableroExistente = await db
      .select()
      .from(boards)
      .where(eq(boards.brandId, brandId))
      .limit(1);

    if (tableroExistente.length > 0) {
      console.log("  El tablero ya existe, no se toca.");
      continue;
    }

    const [tablero] = await db
      .insert(boards)
      .values({
        brandId,
        nombre: "Contenido " + marca.nombre,
        descripcion: "Tareas de contenido del equipo de " + marca.nombre + ".",
      })
      .returning();

    await db.insert(boardColumns).values(
      COLUMNAS.map((c) => ({ ...c, boardId: tablero.id })),
    );

    await db.insert(cardLabels).values(
      ETIQUETAS.map((e) => ({ ...e, boardId: tablero.id })),
    );

    console.log(
      "  Tablero creado con " +
        COLUMNAS.length +
        " columnas y " +
        ETIQUETAS.length +
        " etiquetas.",
    );
  }

  await sql.end();
  console.log("Seed listo.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
