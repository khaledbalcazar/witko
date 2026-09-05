import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { db, sql } from "./client";
import { brandMembers, brands, users } from "./schema";

/**
 * Lista los usuarios dados de alta, con su rol y sus marcas.
 *
 *   npm run listar-usuarios
 */

async function main() {
  const todos = await db.select().from(users).orderBy(asc(users.nombre));

  if (todos.length === 0) {
    console.log("");
    console.log("Todavia no hay usuarios.");
    console.log('Crea el primero con: npm run crear-admin -- "Nombre" correo@empresa.com');
    console.log("");
    await sql.end();
    return;
  }

  const membresias = await db
    .select({ userId: brandMembers.userId, marca: brands.nombre })
    .from(brandMembers)
    .innerJoin(brands, eq(brands.id, brandMembers.brandId));

  console.log("");
  for (const usuario of todos) {
    const marcas = membresias
      .filter((m) => m.userId === usuario.id)
      .map((m) => m.marca);

    console.log(usuario.nombre);
    console.log("  correo: " + usuario.email);
    console.log("  rol:    " + usuario.rol + (usuario.activo ? "" : " (inactivo)"));
    console.log("  marcas: " + (marcas.length ? marcas.join(", ") : "ninguna"));
    console.log("");
  }

  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
