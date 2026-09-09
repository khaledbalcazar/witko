import "server-only";
import { supabaseAdmin } from "@/lib/auth/supabase";

/**
 * Bucket de medios de Supabase Storage.
 *
 * Es publico porque al publicar, Meta hace un cURL al archivo desde sus
 * servidores: si la URL pidiera autenticacion, la publicacion fallaria.
 */

// `??` no alcanza: si la variable esta definida pero vacia (o con espacios),
// Supabase recibe un nombre vacio y responde "Bucket not found".
export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "medios";

/**
 * Storage responde `NoSuchBucket` tanto si el bucket no existe como si la
 * clave no tiene permiso para verlo (sin policies, un rol que no sea
 * service_role lo ve como inexistente). Para poder distinguir un caso del otro
 * en los logs, decimos con que rol estabamos hablando. Nunca la clave: solo el
 * rol, que no es secreto.
 */
export function rolDeLaClave(): string {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (clave.startsWith("sb_secret_")) return "clave secreta nueva";
  if (clave.startsWith("sb_publishable_")) return "clave PUBLICA (deberia ser la secreta)";

  const carga = clave.split(".")[1];
  if (!carga) return "formato desconocido";

  try {
    const { role } = JSON.parse(Buffer.from(carga, "base64url").toString());
    return typeof role === "string" ? `JWT legacy con rol "${role}"` : "JWT legacy sin rol";
  } catch {
    return "formato desconocido";
  }
}

export function faltaElBucket(error: { message?: string } | null): boolean {
  return (error as { statusCode?: string } | null)?.statusCode === "404" ||
    /bucket not found/i.test(error?.message ?? "");
}

/**
 * Crea el bucket que falta. Es un paso manual del panel (SETUP.md, seccion 3)
 * y olvidarselo rompe todas las subidas, asi que lo hacemos nosotros.
 * Devuelve el motivo si no se pudo.
 */
export async function crearBucket(): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });

  // Otro request pudo haberlo creado entre medio; eso no es un fallo.
  if (error && !/already exists/i.test(error.message)) {
    return error.message;
  }

  return null;
}

export const MENSAJE_SIN_BUCKET =
  `Supabase no encuentra el bucket "${BUCKET}" y tampoco se pudo crear. ` +
  "Si el bucket existe en el panel, entonces SUPABASE_SERVICE_ROLE_KEY no es " +
  "la clave service_role de ese proyecto. Si no existe, crealo desde " +
  "Storage > New bucket con Public activado (SETUP.md, seccion 3).";

/** Ruta del archivo dentro del bucket. Nunca la elige el navegador. */
export function rutaDeMedio(
  slugMarca: string,
  postId: string,
  nombreArchivo: string,
): string {
  const extension = nombreArchivo.split(".").pop()?.toLowerCase() ?? "bin";
  return slugMarca + "/" + postId + "/" + crypto.randomUUID() + "." + extension;
}
