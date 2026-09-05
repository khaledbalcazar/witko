import type { Plataforma } from "./tipos";

/**
 * Limites de texto por plataforma y utilidades de conteo.
 * El contador de la UI y la validacion del servidor usan estas mismas funciones.
 */

export const LIMITE_CAPTION: Record<Plataforma, number> = {
  INSTAGRAM: 2200,
  FACEBOOK: 63206,
  TIKTOK: 4000,
};

/** Solo TikTok tiene un titulo aparte de la descripcion. */
export const LIMITE_TITULO_TIKTOK = 90;

/** Instagram corta a 30 hashtags: los que sobran se ignoran en silencio. */
export const MAX_HASHTAGS_INSTAGRAM = 30;

/** Caracteres antes del "... mas" en el feed, para la vista previa. */
export const CORTE_VISTA_PREVIA: Record<Plataforma, number> = {
  INSTAGRAM: 125,
  FACEBOOK: 250,
  TIKTOK: 100,
};

const RE_HASHTAG = /#[\p{L}\p{N}_]+/gu;
const RE_MENCION = /@[A-Za-z0-9._]+/g;

export function contarHashtags(texto: string): number {
  return (texto.match(RE_HASHTAG) ?? []).length;
}

export function extraerHashtags(texto: string): string[] {
  return (texto.match(RE_HASHTAG) ?? []).map((h) => h.toLowerCase());
}

export function extraerMenciones(texto: string): string[] {
  return (texto.match(RE_MENCION) ?? []).map((m) => m.slice(1));
}

/**
 * Longitud como la cuenta la plataforma: por punto de codigo, no por unidad
 * UTF-16. Sin esto un emoji contaria doble y el contador mentiria.
 */
export function largo(texto: string): number {
  return [...texto].length;
}

export interface AvisoCaption {
  nivel: "ERROR" | "AVISO";
  mensaje: string;
}

export function revisarCaption(
  texto: string,
  plataforma: Plataforma,
): AvisoCaption[] {
  const avisos: AvisoCaption[] = [];
  const limite = LIMITE_CAPTION[plataforma];
  const n = largo(texto);

  if (n > limite) {
    avisos.push({
      nivel: "ERROR",
      mensaje:
        "El texto tiene " +
        n +
        " caracteres y el maximo es " +
        limite +
        ". Sobran " +
        (n - limite) +
        ".",
    });
  }

  if (plataforma === "INSTAGRAM") {
    const hashtags = contarHashtags(texto);
    if (hashtags > MAX_HASHTAGS_INSTAGRAM) {
      avisos.push({
        nivel: "AVISO",
        mensaje:
          "Hay " +
          hashtags +
          " hashtags. Instagram usa los primeros " +
          MAX_HASHTAGS_INSTAGRAM +
          " e ignora el resto.",
      });
    }
  }

  return avisos;
}

export function revisarTituloTiktok(titulo: string): AvisoCaption[] {
  const n = largo(titulo);
  if (n > LIMITE_TITULO_TIKTOK) {
    return [
      {
        nivel: "ERROR",
        mensaje:
          "El titulo tiene " +
          n +
          " caracteres y el maximo de TikTok es " +
          LIMITE_TITULO_TIKTOK +
          ".",
      },
    ];
  }
  return [];
}

/** Trunca como lo hace el feed, para la vista previa. */
export function truncarComoFeed(
  texto: string,
  plataforma: Plataforma,
): { visible: string; hayMas: boolean } {
  const corte = CORTE_VISTA_PREVIA[plataforma];
  const caracteres = [...texto];
  if (caracteres.length <= corte) {
    return { visible: texto, hayMas: false };
  }
  return { visible: caracteres.slice(0, corte).join(""), hayMas: true };
}
