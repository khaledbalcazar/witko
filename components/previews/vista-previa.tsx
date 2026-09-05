"use client";

import { useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Music2,
  MoreHorizontal,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { truncarComoFeed } from "@/lib/validation/caption";
import type { Plataforma, TipoPost } from "@/lib/validation/tipos";
import { cn } from "@/lib/utils";

/**
 * Mockups de como se va a ver la publicacion en cada red.
 *
 * No buscan ser un pixel perfect: buscan que el Jefe pueda aprobar sabiendo
 * donde se corta el texto, que se ve del caption sin desplegar y como queda la
 * imagen recortada. Por eso el truncado usa los mismos limites que la app real.
 */

export interface DatosVistaPrevia {
  plataforma: Plataforma;
  tipo: TipoPost;
  nombreCuenta: string;
  caption: string;
  ubicacion?: string | null;
  medios: Array<{
    id: string;
    tipo: "IMAGEN" | "VIDEO";
    urlPublica: string;
    thumbnailUrl?: string | null;
  }>;
  etiquetas?: Array<{ username: string; x: number | null; y: number | null }>;
  primerComentario?: string | null;
  esContenidoIA?: boolean;
  tituloTiktok?: string | null;
}

export function VistaPrevia({ datos }: { datos: DatosVistaPrevia }) {
  switch (datos.plataforma) {
    case "INSTAGRAM":
      if (datos.tipo === "IG_STORY") return <StoryInstagram datos={datos} />;
      if (datos.tipo === "IG_REEL") return <ReelInstagram datos={datos} />;
      return <FeedInstagram datos={datos} />;
    case "FACEBOOK":
      return <FeedFacebook datos={datos} />;
    case "TIKTOK":
      return <VistaTiktok datos={datos} />;
  }
}

/* ------------------------------------------------------------------ */
/* Piezas comunes                                                      */
/* ------------------------------------------------------------------ */

function SinMedios({ alto = "aspect-square" }: { alto?: string }) {
  return (
    <div
      className={cn(
        alto,
        "flex items-center justify-center bg-muted text-xs text-muted-foreground",
      )}
    >
      Todavia no subiste ningun archivo
    </div>
  );
}

function Carrusel({
  medios,
  etiquetas,
  alto = "aspect-square",
}: {
  medios: DatosVistaPrevia["medios"];
  etiquetas?: DatosVistaPrevia["etiquetas"];
  alto?: string;
}) {
  const [indice, setIndice] = useState(0);

  if (medios.length === 0) return <SinMedios alto={alto} />;

  const actual = medios[Math.min(indice, medios.length - 1)];
  const conCoordenadas = (etiquetas ?? []).filter(
    (e) => e.x != null && e.y != null,
  );

  return (
    <div className={cn("relative overflow-hidden bg-black", alto)}>
      {actual.tipo === "VIDEO" ? (
        <video
          src={actual.urlPublica}
          className="size-full object-cover"
          muted
          playsInline
          controls
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actual.urlPublica}
          alt=""
          className="size-full object-cover"
        />
      )}

      {indice === 0 &&
        conCoordenadas.map((e, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
            style={{ left: (e.x ?? 0) * 100 + "%", top: (e.y ?? 0) * 100 + "%" }}
          >
            @{e.username}
          </span>
        ))}

      {medios.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            disabled={indice === 0}
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => setIndice((i) => Math.min(medios.length - 1, i + 1))}
            disabled={indice === medios.length - 1}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1 disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {indice + 1}/{medios.length}
          </div>
        </>
      )}
    </div>
  );
}

function CaptionTruncado({
  texto,
  plataforma,
  usuario,
}: {
  texto: string;
  plataforma: Plataforma;
  usuario?: string;
}) {
  const { visible, hayMas } = truncarComoFeed(texto, plataforma);

  if (!texto.trim()) {
    return (
      <p className="text-xs italic text-muted-foreground">Sin texto todavia</p>
    );
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {usuario && <span className="mr-1 font-semibold">{usuario}</span>}
      {visible}
      {hayMas && <span className="text-muted-foreground"> ... mas</span>}
    </p>
  );
}

function Marco({
  children,
  etiqueta,
}: {
  children: React.ReactNode;
  etiqueta: string;
}) {
  return (
    <div className="w-full max-w-sm">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{etiqueta}</p>
      <div className="overflow-hidden rounded-xl border bg-white text-black shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Encabezado({
  nombreCuenta,
  ubicacion,
}: {
  nombreCuenta: string;
  ubicacion?: string | null;
}) {
  return (
    <div className="flex items-center gap-2 p-3">
      <div className="size-8 shrink-0 rounded-full bg-gradient-to-tr from-amber-400 to-pink-600" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{nombreCuenta}</p>
        {ubicacion && (
          <p className="flex items-center gap-1 truncate text-[11px] text-neutral-600">
            <MapPin className="size-3" />
            {ubicacion}
          </p>
        )}
      </div>
      <MoreHorizontal className="ml-auto size-4 text-neutral-500" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

function FeedInstagram({ datos }: { datos: DatosVistaPrevia }) {
  return (
    <Marco etiqueta="Instagram - feed">
      <Encabezado
        nombreCuenta={datos.nombreCuenta}
        ubicacion={datos.ubicacion}
      />
      <Carrusel medios={datos.medios} etiquetas={datos.etiquetas} />

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-4 text-neutral-800">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
          <Send className="size-5" />
          <Bookmark className="ml-auto size-5" />
        </div>

        {datos.esContenidoIA && (
          <p className="text-[11px] text-neutral-500">
            Informacion sobre contenido generado con IA
          </p>
        )}

        <CaptionTruncado
          texto={datos.caption}
          plataforma="INSTAGRAM"
          usuario={datos.nombreCuenta}
        />

        {datos.primerComentario && (
          <p className="text-xs text-neutral-600">
            <span className="font-semibold">{datos.nombreCuenta}</span>{" "}
            {datos.primerComentario}
          </p>
        )}
      </div>
    </Marco>
  );
}

function ReelInstagram({ datos }: { datos: DatosVistaPrevia }) {
  return (
    <Marco etiqueta="Instagram - reel">
      <div className="relative bg-black">
        <Carrusel
          medios={datos.medios}
          etiquetas={datos.etiquetas}
          alto="aspect-[9/16]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
          <p className="text-sm font-semibold">{datos.nombreCuenta}</p>
          <div className="mt-1 text-xs">
            <CaptionTruncadoClaro texto={datos.caption} />
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px]">
            <Music2 className="size-3" />
            Audio original
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-16 right-2 flex flex-col gap-4 text-white">
          <Heart className="size-6" />
          <MessageCircle className="size-6" />
          <Send className="size-6" />
        </div>
      </div>
    </Marco>
  );
}

function CaptionTruncadoClaro({ texto }: { texto: string }) {
  const { visible, hayMas } = truncarComoFeed(texto, "INSTAGRAM");
  if (!texto.trim()) return <span className="italic opacity-70">Sin texto</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      {visible}
      {hayMas && <span className="opacity-70"> ... mas</span>}
    </span>
  );
}

function StoryInstagram({ datos }: { datos: DatosVistaPrevia }) {
  return (
    <Marco etiqueta="Instagram - historia">
      <div className="relative bg-black">
        <Carrusel
          medios={datos.medios}
          etiquetas={datos.etiquetas}
          alto="aspect-[9/16]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
          <div className="h-0.5 w-full rounded bg-white/80" />
          <div className="mt-3 flex items-center gap-2 text-white">
            <div className="size-7 rounded-full bg-gradient-to-tr from-amber-400 to-pink-600" />
            <span className="text-xs font-semibold">{datos.nombreCuenta}</span>
          </div>
        </div>
        {datos.ubicacion && (
          <span className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded bg-white px-2 py-1 text-[11px] font-medium text-black">
            {datos.ubicacion}
          </span>
        )}
      </div>
      <p className="border-t bg-amber-50 p-2 text-[11px] text-amber-900">
        Las historias desaparecen a las 24 horas de publicarse.
      </p>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/* Facebook                                                            */
/* ------------------------------------------------------------------ */

function FeedFacebook({ datos }: { datos: DatosVistaPrevia }) {
  return (
    <Marco etiqueta={datos.tipo === "FB_REEL" ? "Facebook - reel" : "Facebook - feed"}>
      <div className="flex items-center gap-2 p-3">
        <div className="size-9 shrink-0 rounded-full bg-blue-600" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{datos.nombreCuenta}</p>
          <p className="text-[11px] text-neutral-500">
            Ahora
            {datos.ubicacion ? " - " + datos.ubicacion : ""}
          </p>
        </div>
      </div>

      <div className="px-3 pb-2">
        <CaptionTruncado texto={datos.caption} plataforma="FACEBOOK" />
      </div>

      <Carrusel
        medios={datos.medios}
        alto={datos.tipo === "FB_REEL" ? "aspect-[9/16]" : "aspect-[4/3]"}
      />

      <div className="flex items-center justify-around border-t p-2 text-xs text-neutral-600">
        <span className="flex items-center gap-1">
          <ThumbsUp className="size-4" /> Me gusta
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="size-4" /> Comentar
        </span>
        <span className="flex items-center gap-1">
          <Share2 className="size-4" /> Compartir
        </span>
      </div>
    </Marco>
  );
}

/* ------------------------------------------------------------------ */
/* TikTok                                                              */
/* ------------------------------------------------------------------ */

function VistaTiktok({ datos }: { datos: DatosVistaPrevia }) {
  return (
    <Marco etiqueta="TikTok">
      <div className="relative bg-black">
        <Carrusel medios={datos.medios} alto="aspect-[9/16]" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-white">
          <p className="text-sm font-semibold">@{datos.nombreCuenta}</p>
          {datos.tituloTiktok && (
            <p className="mt-1 truncate text-sm font-medium">
              {datos.tituloTiktok}
            </p>
          )}
          <div className="mt-1 text-xs">
            <CaptionTiktok texto={datos.caption} />
          </div>
          {datos.esContenidoIA && (
            <p className="mt-2 inline-block rounded bg-white/20 px-1.5 py-0.5 text-[10px]">
              Generado con IA
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-20 right-2 flex flex-col gap-4 text-white">
          <Heart className="size-6" />
          <MessageCircle className="size-6" />
          <Share2 className="size-6" />
        </div>
      </div>
    </Marco>
  );
}

function CaptionTiktok({ texto }: { texto: string }) {
  const { visible, hayMas } = truncarComoFeed(texto, "TIKTOK");
  if (!texto.trim()) return <span className="italic opacity-70">Sin texto</span>;
  return (
    <span className="whitespace-pre-wrap break-words">
      {visible}
      {hayMas && <span className="opacity-70"> ... mas</span>}
    </span>
  );
}
