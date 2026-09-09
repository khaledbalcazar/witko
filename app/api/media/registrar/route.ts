import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, posts } from "@/db/schema";
import { exigirSesion } from "@/lib/auth/sesion";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { BUCKET } from "@/lib/storage/medios";
import { validarArchivo } from "@/lib/validation/media-limits";
import type { TipoPost } from "@/lib/validation/tipos";

/**
 * Registra un archivo que el navegador ya subio con una URL firmada.
 *
 * El tamano y el tipo salen de Storage, no del navegador: el cliente pudo
 * haber mentido al pedir la firma. Si lo que quedo subido no cumple, se borra
 * en vez de dejar basura en el bucket.
 */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const sesion = await exigirSesion();

  const cuerpo = await request.json().catch(() => null);
  const postId = typeof cuerpo?.postId === "string" ? cuerpo.postId : "";
  const ruta = typeof cuerpo?.ruta === "string" ? cuerpo.ruta : "";
  const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre : "archivo";
  const ancho = Number(cuerpo?.ancho) || null;
  const alto = Number(cuerpo?.alto) || null;
  const duracionMs = Number(cuerpo?.duracionMs) || null;

  if (!postId || !ruta) {
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

  // La ruta la arma el servidor al firmar. Si la que llega no es de esta marca
  // y esta publicacion, alguien la escribio a mano.
  if (!ruta.startsWith(sesion.marcaActiva.slug + "/" + postId + "/")) {
    return NextResponse.json(
      { ok: false, mensaje: "Esa ruta no corresponde a esta publicacion." },
      { status: 403 },
    );
  }

  const supabase = supabaseAdmin();
  const { data: info, error } = await supabase.storage.from(BUCKET).info(ruta);

  if (error || !info) {
    console.error("No se encontro en Storage el archivo recien subido:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No encontramos el archivo subido. Volve a intentar." },
      { status: 404 },
    );
  }

  const mime = info.contentType ?? "application/octet-stream";
  const bytes = info.size ?? 0;

  const problema = validarArchivo(
    {
      nombre,
      mime,
      bytes,
      ancho,
      alto,
      duracionSeg: duracionMs != null ? duracionMs / 1000 : null,
    },
    post.tipo as TipoPost,
    null,
    post.proporcion,
  );

  if (problema) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return NextResponse.json(
      { ok: false, mensaje: problema.mensaje },
      { status: 422 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(ruta);

  const [{ siguiente }] = await db
    .select({
      siguiente: sql<number>`coalesce(max(${mediaAssets.orden}), -1) + 1`,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.postId, postId));

  const [creado] = await db
    .insert(mediaAssets)
    .values({
      postId,
      orden: siguiente,
      tipo: mime.startsWith("video/") ? "VIDEO" : "IMAGEN",
      storagePath: ruta,
      urlPublica: publicUrl,
      mime,
      bytes,
      ancho,
      alto,
      duracionMs,
    })
    .returning();

  return NextResponse.json({ ok: true, media: creado });
}
