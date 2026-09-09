import { TIPOS_CON_PROPORCION, type ProporcionPost, type TipoPost } from "./tipos";

/**
 * Limites de medios por tipo de publicacion.
 *
 * Se usan dos veces: en el navegador antes de subir el archivo (para no gastar
 * la subida en algo que va a ser rechazado) y en el servidor al validar el post
 * antes de encolarlo. Misma fuente, mismos mensajes.
 */

export interface LimitesMedia {
  /** Cantidad de archivos permitida. */
  minArchivos: number;
  maxArchivos: number;
  acepta: Array<"IMAGEN" | "VIDEO">;
  mimesImagen: string[];
  mimesVideo: string[];
  maxBytesImagen: number;
  maxBytesVideo: number;
  /** Duracion de video en segundos. `null` cuando la define la plataforma. */
  minDuracionSeg: number | null;
  maxDuracionSeg: number | null;
  /** Relacion de aspecto ancho/alto admitida. */
  minRatio: number | null;
  maxRatio: number | null;
  /** Proporciones entre las que elige el usuario. Vacio si no elige. */
  proporciones: ProporcionPost[];
  /** Nota que se muestra bajo el dropzone. */
  nota: string;
}

const MB = 1024 * 1024;

const JPEG_PNG = ["image/jpeg", "image/png"];
const VIDEO_MP4 = ["video/mp4", "video/quicktime"];

export const LIMITES: Record<TipoPost, LimitesMedia> = {
  IG_FEED: {
    minArchivos: 1,
    maxArchivos: 1,
    acepta: ["IMAGEN"],
    mimesImagen: JPEG_PNG,
    mimesVideo: [],
    maxBytesImagen: 8 * MB,
    maxBytesVideo: 0,
    minDuracionSeg: null,
    maxDuracionSeg: null,
    minRatio: 0.8, // 4:5 vertical
    maxRatio: 1.91, // 1.91:1 horizontal
    proporciones: [],
    nota: "Una imagen JPG o PNG, hasta 8 MB, entre 4:5 y 1.91:1.",
  },
  IG_CARRUSEL: {
    minArchivos: 2,
    maxArchivos: 10,
    acepta: ["IMAGEN", "VIDEO"],
    mimesImagen: JPEG_PNG,
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 8 * MB,
    maxBytesVideo: 1024 * MB,
    minDuracionSeg: 3,
    maxDuracionSeg: 60,
    minRatio: 0.8,
    maxRatio: 1.91,
    proporciones: ["CUADRADA", "VERTICAL"],
    nota:
      "Entre 2 y 10 elementos, todos en 1:1 o todos en 4:5. " +
      "Los reels no se pueden poner en carrusel.",
  },
  IG_REEL: {
    minArchivos: 1,
    maxArchivos: 1,
    acepta: ["VIDEO"],
    mimesImagen: [],
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 0,
    maxBytesVideo: 1024 * MB,
    minDuracionSeg: 3,
    maxDuracionSeg: 15 * 60,
    minRatio: 0.5, // 9:16 = 0.5625; se deja margen
    maxRatio: 0.6,
    proporciones: [],
    nota: "Un video vertical (9:16), de 3 segundos a 15 minutos.",
  },
  IG_STORY: {
    minArchivos: 1,
    maxArchivos: 1,
    acepta: ["IMAGEN", "VIDEO"],
    mimesImagen: JPEG_PNG,
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 8 * MB,
    maxBytesVideo: 100 * MB,
    minDuracionSeg: 1,
    maxDuracionSeg: 60,
    minRatio: 0.5,
    maxRatio: 0.6,
    proporciones: [],
    nota: "Una imagen o video vertical de hasta 60 segundos. Desaparece a las 24 horas.",
  },
  FB_FEED: {
    minArchivos: 1,
    maxArchivos: 10,
    acepta: ["IMAGEN", "VIDEO"],
    mimesImagen: JPEG_PNG,
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 10 * MB,
    maxBytesVideo: 1024 * MB,
    minDuracionSeg: 1,
    maxDuracionSeg: 240 * 60,
    minRatio: null,
    maxRatio: null,
    proporciones: [],
    nota: "Hasta 10 imagenes, o un video.",
  },
  FB_REEL: {
    minArchivos: 1,
    maxArchivos: 1,
    acepta: ["VIDEO"],
    mimesImagen: [],
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 0,
    maxBytesVideo: 1024 * MB,
    minDuracionSeg: 3,
    maxDuracionSeg: 90,
    minRatio: 0.5,
    maxRatio: 0.6,
    proporciones: [],
    nota: "Un video vertical de 3 a 90 segundos.",
  },
  TT_VIDEO: {
    minArchivos: 1,
    maxArchivos: 1,
    acepta: ["VIDEO"],
    mimesImagen: [],
    mimesVideo: VIDEO_MP4,
    maxBytesImagen: 0,
    maxBytesVideo: 4096 * MB,
    minDuracionSeg: 1,
    // El tope real lo dice max_video_post_duration_sec de creator_info.
    // Este valor es solo el fallback cuando todavia no consultamos la cuenta.
    maxDuracionSeg: null,
    minRatio: null,
    maxRatio: null,
    proporciones: [],
    nota: "Un video. La duracion maxima depende de la cuenta de TikTok.",
  },
  TT_FOTO: {
    minArchivos: 1,
    maxArchivos: 35,
    acepta: ["IMAGEN"],
    mimesImagen: ["image/jpeg", "image/webp"],
    mimesVideo: [],
    maxBytesImagen: 20 * MB,
    maxBytesVideo: 0,
    minDuracionSeg: null,
    maxDuracionSeg: null,
    minRatio: null,
    maxRatio: null,
    proporciones: [],
    nota: "Hasta 35 imagenes JPG o WEBP.",
  },
};

/**
 * Proporciones del carrusel. Instagram publica todo el carrusel con una sola,
 * asi que se elige una vez y todos los archivos tienen que cumplirla: si no,
 * Instagram recorta por su cuenta y el resultado no es el que se vio al armar
 * la publicacion.
 */
export const PROPORCIONES: Record<
  ProporcionPost,
  { ratio: number; etiqueta: string; nombre: string }
> = {
  CUADRADA: { ratio: 1, etiqueta: "1:1", nombre: "cuadrada" },
  VERTICAL: { ratio: 0.8, etiqueta: "4:5", nombre: "vertical" },
};

/**
 * Margen sobre la proporcion exacta. Un 2% deja pasar los redondeos de las
 * exportaciones (1080x1349 en vez de 1080x1350) sin aceptar otra proporcion:
 * 1:1 y 4:5 estan a un 20% de distancia.
 */
const TOLERANCIA_RATIO = 0.02;

export function cumpleProporcion(
  ancho: number,
  alto: number,
  proporcion: ProporcionPost,
): boolean {
  const objetivo = PROPORCIONES[proporcion].ratio;
  return Math.abs(ancho / alto - objetivo) <= objetivo * TOLERANCIA_RATIO;
}

/** Fallback de duracion de TikTok mientras no haya respuesta de creator_info. */
export const TIKTOK_DURACION_FALLBACK_SEG = 600;

export interface ArchivoCandidato {
  nombre: string;
  mime: string;
  bytes: number;
  ancho?: number | null;
  alto?: number | null;
  duracionSeg?: number | null;
}

export interface ProblemaMedia {
  archivo: string;
  mensaje: string;
}

function mb(bytes: number): string {
  return (bytes / MB).toFixed(bytes >= MB * 10 ? 0 : 1).replace(".0", "") + " MB";
}

function duracion(segundos: number): string {
  if (segundos < 60) {
    return segundos + (segundos === 1 ? " segundo" : " segundos");
  }
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (resto !== 0) return minutos + " min " + resto + " s";
  return minutos + (minutos === 1 ? " minuto" : " minutos");
}

/**
 * Valida un archivo suelto. Devuelve el problema o `null` si esta bien.
 * El mensaje siempre dice que esta mal y cual es el limite.
 */
export function validarArchivo(
  archivo: ArchivoCandidato,
  tipo: TipoPost,
  maxDuracionSegOverride?: number | null,
  proporcion?: ProporcionPost | null,
): ProblemaMedia | null {
  const limite = LIMITES[tipo];
  const esImagen = archivo.mime.startsWith("image/");
  const esVideo = archivo.mime.startsWith("video/");

  const clase = esImagen ? "IMAGEN" : esVideo ? "VIDEO" : null;
  if (!clase || !limite.acepta.includes(clase)) {
    return {
      archivo: archivo.nombre,
      mensaje:
        "Este tipo de publicacion no acepta " +
        (clase === "VIDEO" ? "videos" : clase === "IMAGEN" ? "imagenes" : "este archivo") +
        ". " +
        limite.nota,
    };
  }

  const mimesOk = esImagen ? limite.mimesImagen : limite.mimesVideo;
  if (!mimesOk.includes(archivo.mime)) {
    return {
      archivo: archivo.nombre,
      mensaje:
        "Formato " +
        archivo.mime +
        " no admitido. Se aceptan: " +
        mimesOk.map((m) => m.split("/")[1].toUpperCase()).join(", ") +
        ".",
    };
  }

  const maxBytes = esImagen ? limite.maxBytesImagen : limite.maxBytesVideo;
  if (archivo.bytes > maxBytes) {
    return {
      archivo: archivo.nombre,
      mensaje:
        "Pesa " + mb(archivo.bytes) + " y el maximo es " + mb(maxBytes) + ".",
    };
  }

  if (esVideo && archivo.duracionSeg != null) {
    const maxDuracion =
      maxDuracionSegOverride ??
      limite.maxDuracionSeg ??
      (tipo === "TT_VIDEO" ? TIKTOK_DURACION_FALLBACK_SEG : null);

    if (limite.minDuracionSeg != null && archivo.duracionSeg < limite.minDuracionSeg) {
      return {
        archivo: archivo.nombre,
        mensaje:
          "Dura " +
          duracion(Math.round(archivo.duracionSeg)) +
          " y el minimo es " +
          duracion(limite.minDuracionSeg) +
          ".",
      };
    }
    if (maxDuracion != null && archivo.duracionSeg > maxDuracion) {
      return {
        archivo: archivo.nombre,
        mensaje:
          "Dura " +
          duracion(Math.round(archivo.duracionSeg)) +
          " y el maximo es " +
          duracion(maxDuracion) +
          ".",
      };
    }
  }

  const eligeProporcion =
    proporcion != null && limite.proporciones.includes(proporcion);

  // Con una proporcion elegida manda esa y no el rango: el carrusel se publica
  // entero con una sola, y lo que no encaje lo recorta Instagram sin avisar.
  if (eligeProporcion && archivo.ancho && archivo.alto) {
    if (!cumpleProporcion(archivo.ancho, archivo.alto, proporcion)) {
      const { etiqueta, nombre } = PROPORCIONES[proporcion];
      return {
        archivo: archivo.nombre,
        mensaje:
          "Mide " +
          archivo.ancho +
          "x" +
          archivo.alto +
          " y el carrusel esta en " +
          etiqueta +
          " (" +
          nombre +
          "). Recortala a " +
          etiqueta +
          " o cambia la proporcion del carrusel.",
      };
    }
  } else if (archivo.ancho && archivo.alto && limite.minRatio && limite.maxRatio) {
    const ratio = archivo.ancho / archivo.alto;
    if (ratio < limite.minRatio || ratio > limite.maxRatio) {
      return {
        archivo: archivo.nombre,
        mensaje:
          "La proporcion es " +
          ratio.toFixed(2) +
          ":1 y tiene que estar entre " +
          limite.minRatio.toFixed(2) +
          ":1 y " +
          limite.maxRatio.toFixed(2) +
          ":1. " +
          limite.nota,
      };
    }
  }

  return null;
}

/** Valida el conjunto: cantidad de archivos y combinaciones no permitidas. */
export function validarConjunto(
  archivos: ArchivoCandidato[],
  tipo: TipoPost,
  proporcion?: ProporcionPost | null,
): ProblemaMedia[] {
  const limite = LIMITES[tipo];
  const problemas: ProblemaMedia[] = [];

  if (archivos.length < limite.minArchivos) {
    problemas.push({
      archivo: "",
      mensaje:
        "Faltan archivos: hacen falta al menos " +
        limite.minArchivos +
        " y hay " +
        archivos.length +
        ".",
    });
  }

  if (archivos.length > limite.maxArchivos) {
    problemas.push({
      archivo: "",
      mensaje:
        "Hay " +
        archivos.length +
        " archivos y el maximo es " +
        limite.maxArchivos +
        ".",
    });
  }

  // Un carrusel sin proporcion elegida es de los anteriores a esta funcion:
  // sus archivos pueden no coincidir entre si, y ahi Instagram recorta todo a
  // la proporcion del primero.
  if (
    limite.proporciones.length > 0 &&
    proporcion == null &&
    archivos.length > 1
  ) {
    const ratios = archivos.flatMap((a) =>
      a.ancho && a.alto ? [a.ancho / a.alto] : [],
    );
    const dispares = ratios.some(
      (r) => Math.abs(r - ratios[0]) > ratios[0] * TOLERANCIA_RATIO,
    );

    if (dispares) {
      problemas.push({
        archivo: "",
        mensaje:
          "Los archivos tienen proporciones distintas y el carrusel se publica " +
          "con una sola: elegi 1:1 o 4:5 para que todos queden iguales.",
      });
    }
  }

  return problemas;
}
