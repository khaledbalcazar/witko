import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { brandMembers, brands, users } from "./schema";

/**
 * Crea el primer usuario administrador.
 *
 * Supabase no permite setear contrasenas por SQL, asi que este script usa la
 * API de administracion. Es solo para el arranque: despues los usuarios se
 * invitan desde /admin/usuarios dentro de la app.
 *
 *   npm run crear-admin -- "Nombre Apellido" correo@empresa.com
 */

async function main() {
  const [nombre, email] = process.argv.slice(2);

  if (!nombre || !email) {
    console.error(
      'Uso: npm run crear-admin -- "Nombre Apellido" correo@empresa.com',
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env.",
    );
    process.exit(1);
  }

  const correo = email.trim().toLowerCase();

  const yaExiste = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, correo))
    .limit(1);

  if (yaExiste.length > 0) {
    console.error("Ya hay un usuario con el correo " + correo + ".");
    await sql.end();
    process.exit(1);
  }

  const marcas = await db.select().from(brands);
  if (marcas.length === 0) {
    console.error("No hay marcas. Corre primero: npm run db:seed");
    await sql.end();
    process.exit(1);
  }

  const password = randomBytes(9).toString("base64url");

  const supabase = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (error || !data.user) {
    console.error("No se pudo crear el usuario:", error?.message);
    await sql.end();
    process.exit(1);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: data.user.id,
        nombre,
        email: correo,
        rol: "ADMIN",
      });

      // El primer admin entra a todas las marcas: es quien va a dar de alta al
      // resto del equipo.
      await tx.insert(brandMembers).values(
        marcas.map((m) => ({
          brandId: m.id,
          userId: data.user.id,
          rol: "ADMIN" as const,
        })),
      );
    });
  } catch (error) {
    // Un usuario en Auth que no existe en `users` no puede entrar ni ser
    // reinvitado: mejor deshacerlo.
    await supabase.auth.admin.deleteUser(data.user.id);
    console.error("No se pudo completar el alta:", error);
    await sql.end();
    process.exit(1);
  }

  await sql.end();

  console.log("");
  console.log("Administrador creado.");
  console.log("  Correo:      " + correo);
  console.log("  Contrasena:  " + password);
  console.log("  Marcas:      " + marcas.map((m) => m.nombre).join(", "));
  console.log("");
  console.log("Entra en http://localhost:3000/login y cambia la contrasena.");
  console.log("");
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
