import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { users } from "./schema";

/**
 * Genera una contrasena nueva para un usuario.
 *
 * Sirve para cuando alguien se olvida la suya y todavia no hay envio de
 * correos configurado (ver SETUP.md, paso 10). Se corre desde la maquina de
 * quien administra, que es quien tiene la clave de servicio.
 *
 *   npm run resetear-password -- correo@empresa.com
 */

async function main() {
  const [email] = process.argv.slice(2);

  if (!email) {
    console.error("Uso: npm run resetear-password -- correo@empresa.com");
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

  const filas = await db
    .select({ id: users.id, nombre: users.nombre, activo: users.activo })
    .from(users)
    .where(eq(users.email, correo))
    .limit(1);

  const usuario = filas[0];
  if (!usuario) {
    console.error("No hay ningun usuario con el correo " + correo + ".");
    console.error("Para ver los que existen: npm run listar-usuarios");
    await sql.end();
    process.exit(1);
  }

  const password = randomBytes(9).toString("base64url");

  const supabase = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.admin.updateUserById(usuario.id, {
    password,
  });

  if (error) {
    console.error("No se pudo cambiar la contrasena:", error.message);
    await sql.end();
    process.exit(1);
  }

  await sql.end();

  console.log("");
  console.log("Contrasena nueva para " + usuario.nombre + ".");
  console.log("  Correo:      " + correo);
  console.log("  Contrasena:  " + password);
  if (!usuario.activo) {
    console.log("");
    console.log(
      "  Ojo: este usuario esta desactivado y no va a poder entrar hasta",
    );
    console.log("  que lo reactives desde Administracion > Usuarios.");
  }
  console.log("");
  console.log("Entra en http://localhost:3000/login y cambiala.");
  console.log("");
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
