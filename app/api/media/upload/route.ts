import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, posts } from "@/db/schema";
import { exigirSesion } from "@/lib/auth/sesion";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { validarArchivo } from "@/lib/validation/media-limits";
import type { TipoPost } from "@/lib/validation/tipos";

/**
 * Subida de medios a Supabase Storage.
 *
 * El bucket es publico porque al publicar, Meta hace un cURL al archivo desde
 * sus servidores: si la URL pidiera autenticacion, la publicacion fallaria.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "medios";

/**
 * Rate limit por usuario, en memoria del proceso.
 * Alcanza para un equipo de marketing con una sola instancia; si algun dia hay
 * varias, esto se mueve a una tabla de Postgres.
 */
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 30;
const cubos = new Map<string, { desde: number; usados: number }>();

function superaLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const cubo = cubos.get(usuarioId);

  if (!cubo || ahora - cubo.desde > VENTANA_MS) {
    cubos.set(usuarioId, { desde: ahora, usados: 1 });
    return false;
  }

  cubo.usados += 1;
  return cubo.usados > MAX_POR_VENTANA;
}

export async function POST(request: Request) {
  const sesion = await exigirSesion();

  if (superaLimite(sesion.usuario.id)) {
    return NextResponse.json(
      { ok: false, mensaje: "Estas subiendo demasiados archivos seguidos. Espera un minuto." },
      { status: 429 },
    );
  }

  const formulario = await request.formData();
  const archivo = formulario.get("archivo");
  const postId = String(formulario.get("postId") ?? "");
  const ancho = Number(formulario.get("ancho") ?? 0) || null;
  const alto = Number(formulario.get("alto") ?? 0) || null;
  const duracionMs = Number(formulario.get("duracionMs") ?? 0) || null;

  if (!(archivo instanceof File) || !postId) {
    return NextResponse.json(
      { ok: false, mensaje: "Falta el archivo o la publicacion." },
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

  // Se vuelve a validar del lado del servidor lo que el navegador ya valido:
  // el cliente puede mentir sobre el tamano o el tipo.
  const problema = validarArchivo(
    {
      nombre: archivo.name,
      mime: archivo.type,
      bytes: archivo.size,
      ancho,
      alto,
      duracionSeg: duracionMs != null ? duracionMs / 1000 : null,
    },
    post.tipo as TipoPost,
  );

  if (problema) {
    return NextResponse.json(
      { ok: false, mensaje: problema.mensaje },
      { status: 422 },
    );
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "bin";
  const ruta =
    sesion.marcaActiva.slug +
    "/" +
    postId +
    "/" +
    crypto.randomUUID() +
    "." +
    extension;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

  if (error) {
    console.error("Fallo la subida a Storage:", error);
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo subir el archivo. Volve a intentar." },
      { status: 502 },
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
      tipo: archivo.type.startsWith("video/") ? "VIDEO" : "IMAGEN",
      storagePath: ruta,
      urlPublica: publicUrl,
      mime: archivo.type,
      bytes: archivo.size,
      ancho,
      alto,
      duracionMs,
    })
    .returning();

  return NextResponse.json({ ok: true, media: creado });
}
