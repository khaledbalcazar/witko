import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Clientes de Supabase Auth del lado del servidor.
 *
 * Solo se usan para la sesion (login, logout, refresco de token). Todas las
 * consultas de datos van por Drizzle, no por el cliente de Supabase: asi la
 * autorizacion la decide siempre nuestro codigo y no queda repartida entre RLS
 * y la app.
 *
 * El cliente de navegador esta en `supabase-navegador.ts`: este archivo importa
 * `next/headers` y no se puede empaquetar para el cliente.
 */

function variables(): { url: string; anon: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(FALTA_CONFIGURACION);
  }
  return { url, anon };
}

/**
 * El error mas probable en el primer arranque. Dice que hacer, porque
 * "faltan variables" no le sirve a nadie que recien clona el proyecto.
 */
export const FALTA_CONFIGURACION =
  "Falta configurar Supabase. Abri .env.local y completa NEXT_PUBLIC_SUPABASE_URL, " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY y DATABASE_URL con los datos " +
  "de tu proyecto de Supabase (Project Settings > API y > Database). Los pasos estan en " +
  "SETUP.md, seccion 2.";

export async function supabaseServidor() {
  const { url, anon } = variables();
  const almacen = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(nuevas) {
        try {
          for (const { name, value, options } of nuevas) {
            almacen.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies. El refresco de la
          // sesion lo hace el middleware, asi que ignorarlo aca es correcto.
        }
      },
    },
  });
}

/** Cliente con service_role, para lo que tiene que saltear RLS. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
