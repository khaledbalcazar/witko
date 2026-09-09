import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { posts } from "@/db/schema";
import { exigirSesion } from "@/lib/auth/sesion";
import { supabaseAdmin } from "@/lib/auth/supabase";
import {
  BUCKET,
  MENSAJE_SIN_BUCKET,
  crearBucket,
  faltaElBucket,
  rolDeLaClave,
  rutaDeMedio,
} from "@/lib/storage/medios";
import { superaLimite } from "@/lib/storage/rate-limit";
import { validarArchivo } from "@/lib/validation/media-limits";
import type { TipoPost } from "@/lib/validation/tipos";

/**
 * Firma una subida directa del navegador a Supabase Storage.
 *
 * El archivo no pasa por el servidor: Vercel corta los cuerpos de mas de
 * 4.5 MB antes de ejecutar la funcion, asi que subir un video por aca era
 * imposible y el navegador solo veia un error de red. El servidor sigue
 * decidiendo que se acepta y donde se guarda; lo unico que cambia es quien
 * transporta los bytes.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sesion = await exigirSesion();

  if (superaLimite(sesion.usuario.id)) {
    return NextResponse.json(
      { ok: false, mensaje: "Estas subiendo demasiados archivos seguidos. Espera un minuto." },
      { status: 429 },
    );
  }

  const cuerpo = await request.json().catch(() => null);
  const postId = typeof cuerpo?.postId === "string" ? cuerpo.postId : "";
  const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre : "";
  const mime = typeof cuerpo?.mime === "string" ? cuerpo.mime : "";
  const bytes = Number(cuerpo?.bytes ?? 0);

  if (!postId || !nombre || !mime || !bytes) {
    return NextResponse.json(
      { ok: false, mensaje: "Faltan datos del archivo." },
      { status: 400 },
    );
  }

  const filas = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.brandId, sesion.marcaActiva.id)))
    .limit(1);

  const post = filas[0];
  if (!post) {
    return NextResponse.json(
      { ok: false, mensaje: "No encontramos esa publicacion." },
      { status: 404 },
    );
  }

  if (post.estado === "PUBLICADO" || post.estado === "PUBLICANDO") {
    return NextResponse.json(
      { ok: false, mensaje: "Esta publicacion ya no se puede editar." },
      { status: 409 },
    );
  }

  // Primera validacion, con lo que dice el navegador. La definitiva corre al
  // registrar, ya con el tamano y el tipo que informa Storage.
  const problema = validarArchivo(
    {
      nombre,
      mime,
      bytes,
      ancho: Number(cuerpo?.ancho) || null,
      alto: Number(cuerpo?.alto) || null,
      duracionSeg: Number(cuerpo?.duracionMs) ? Number(cuerpo.duracionMs) / 1000 : null,
    },
    post.tipo as TipoPost,
    null,
    post.proporcion,
  );

  if (problema) {
    return NextResponse.json(
      { ok: false, mensaje: problema.mensaje },
      { status: 422 },
    );
  }

  const ruta = rutaDeMedio(sesion.marcaActiva.slug, postId, nombre);
  const supabase = supabaseAdmin();

  const firmar = () => supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);

  let { data, error } = await firmar();

  if (error && faltaElBucket(error)) {
    console.warn(
      `Storage no encuentra el bucket "${BUCKET}" en ` +
        `${process.env.NEXT_PUBLIC_SUPABASE_URL} (${rolDeLaClave()}); intentando crearlo.`,
    );
    const falloAlCrear = await crearBucket();

    if (falloAlCrear) {
      console.error(`No se pudo crear el bucket "${BUCKET}":`, falloAlCrear);
      return NextResponse.json(
        { ok: false, mensaje: MENSAJE_SIN_BUCKET },
        { status: 502 },
      );
    }

    ({ data, error } = await firmar());
  }

  if (error || !data) {
    console.error("No se pudo firmar la subida:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo preparar la subida. Volve a intentar." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    ruta: data.path,
    token: data.token,
  });
}
