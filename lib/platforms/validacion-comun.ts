import { revisarCaption, revisarTituloTiktok } from "@/lib/validation/caption";
import {
  validarArchivo,
  validarConjunto,
  type ArchivoCandidato,
} from "@/lib/validation/media-limits";
import { CAPACIDADES } from "@/lib/validation/tipos";
import type {
  DestinoParaPublicar,
  MediaParaPublicar,
  ProblemaValidacion,
  ResultadoValidacion,
} from "./types";

/**
 * Validacion que comparten todos los adaptadores: es la misma que corre en el
 * navegador antes de subir, aplicada del lado del servidor sobre lo que quedo
 * guardado. Cada adaptador real le suma lo suyo.
 */

function comoCandidato(m: MediaParaPublicar): ArchivoCandidato {
  return {
    nombre: "archivo " + (m.orden + 1),
    mime: m.mime,
    bytes: m.bytes,
    ancho: m.ancho,
    alto: m.alto,
    duracionSeg: m.duracionMs != null ? m.duracionMs / 1000 : null,
  };
}

export function validarDestino(
  destino: DestinoParaPublicar,
  media: MediaParaPublicar[],
  maxDuracionSeg?: number | null,
): ResultadoValidacion {
  const problemas: ProblemaValidacion[] = [];
  const capacidades = CAPACIDADES[destino.plataforma];

  for (const p of validarConjunto(media.map(comoCandidato), destino.tipo)) {
    problemas.push({ campo: "medios", mensaje: p.mensaje, nivel: "ERROR" });
  }

  for (const m of media) {
    const problema = validarArchivo(
      comoCandidato(m),
      destino.tipo,
      maxDuracionSeg,
    );
    if (problema) {
      problemas.push({
        campo: "medios",
        mensaje: problema.archivo + ": " + problema.mensaje,
        nivel: "ERROR",
      });
    }
  }

  for (const aviso of revisarCaption(destino.caption, destino.plataforma)) {
    problemas.push({
      campo: "caption",
      mensaje: aviso.mensaje,
      nivel: aviso.nivel,
    });
  }

  if (destino.plataforma === "TIKTOK") {
    const titulo = destino.config.tiktok?.titulo;
    if (titulo) {
      for (const aviso of revisarTituloTiktok(titulo)) {
        problemas.push({
          campo: "titulo",
          mensaje: aviso.mensaje,
          nivel: aviso.nivel,
        });
      }
    }

    // Regla de TikTok: si el contenido esta marcado como de marca, no puede ser
    // privado. La UI ya lo fuerza, pero el servidor no confia en la UI.
    const tt = destino.config.tiktok;
    if (tt?.brandContentToggle && tt.privacidad && tt.privacidad !== "PUBLIC_TO_EVERYONE") {
      problemas.push({
        campo: "privacidad",
        mensaje:
          "El contenido marcado como promocion de marca tiene que ser publico.",
        nivel: "ERROR",
      });
    }
  }

  if (destino.primerComentario && !capacidades.primerComentario) {
    problemas.push({
      campo: "primerComentario",
      mensaje:
        "El primer comentario no se puede publicar por API en esta plataforma.",
      nivel: "AVISO",
    });
  }

  // alt_text solo lo acepta la API en imagenes de feed y carrusel.
  const admiteAlt =
    capacidades.altTextEnImagen &&
    (destino.tipo === "IG_FEED" || destino.tipo === "IG_CARRUSEL");
  if (destino.altText && !admiteAlt) {
    problemas.push({
      campo: "altText",
      mensaje:
        "El texto alternativo no se aplica en reels ni en historias: se va a ignorar.",
      nivel: "AVISO",
    });
  }

  if (destino.locationId && !capacidades.ubicacion) {
    problemas.push({
      campo: "ubicacion",
      mensaje: "Esta plataforma no admite ubicacion por API.",
      nivel: "AVISO",
    });
  }

  const conCoordenadas = media.some((m) =>
    m.etiquetas.some((e) => e.x != null || e.y != null),
  );
  if (conCoordenadas && !capacidades.etiquetasConCoordenadas) {
    problemas.push({
      campo: "etiquetas",
      mensaje:
        "Las etiquetas con posicion sobre la imagen son solo de Instagram.",
      nivel: "AVISO",
    });
  }

  // Instagram acepta coordenadas en imagenes y stories, no en reels ni carrusel.
  if (destino.plataforma === "INSTAGRAM" && conCoordenadas) {
    if (destino.tipo === "IG_REEL") {
      problemas.push({
        campo: "etiquetas",
        mensaje:
          "En un reel las etiquetas no llevan posicion: se van a aplicar sin coordenadas.",
        nivel: "AVISO",
      });
    }
  }

  if (!destino.cuenta.accessToken) {
    problemas.push({
      campo: "cuenta",
      mensaje:
        "La cuenta " +
        destino.cuenta.nombreVisible +
        " no tiene un token valido. Hay que reconectarla.",
      nivel: "ERROR",
    });
  }

  return {
    ok: problemas.every((p) => p.nivel !== "ERROR"),
    problemas,
  };
}
