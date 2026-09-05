/**
 * Tipos de dominio compartidos entre cliente, servidor y worker.
 * Espejan los enums de la base pero sin importar Drizzle, para que el bundle
 * del navegador no arrastre el ORM.
 */

export type Plataforma = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";

export type TipoPost =
  | "IG_FEED"
  | "IG_CARRUSEL"
  | "IG_REEL"
  | "IG_STORY"
  | "FB_FEED"
  | "FB_REEL"
  | "TT_VIDEO"
  | "TT_FOTO";

export type TipoMedia = "IMAGEN" | "VIDEO";

export type EstadoTarget =
  | "PENDIENTE"
  | "PUBLICANDO"
  | "PUBLICADO"
  | "FALLIDO"
  | "CANCELADO";

export const PLATAFORMA_DE_TIPO: Record<TipoPost, Plataforma> = {
  IG_FEED: "INSTAGRAM",
  IG_CARRUSEL: "INSTAGRAM",
  IG_REEL: "INSTAGRAM",
  IG_STORY: "INSTAGRAM",
  FB_FEED: "FACEBOOK",
  FB_REEL: "FACEBOOK",
  TT_VIDEO: "TIKTOK",
  TT_FOTO: "TIKTOK",
};

export const TIPOS_POR_PLATAFORMA: Record<Plataforma, TipoPost[]> = {
  INSTAGRAM: ["IG_FEED", "IG_CARRUSEL", "IG_REEL", "IG_STORY"],
  FACEBOOK: ["FB_FEED", "FB_REEL"],
  TIKTOK: ["TT_VIDEO", "TT_FOTO"],
};

export const ETIQUETA_TIPO: Record<TipoPost, string> = {
  IG_FEED: "Publicacion de feed",
  IG_CARRUSEL: "Carrusel",
  IG_REEL: "Reel",
  IG_STORY: "Historia",
  FB_FEED: "Publicacion de feed",
  FB_REEL: "Reel",
  TT_VIDEO: "Video",
  TT_FOTO: "Fotos",
};

export const ETIQUETA_PLATAFORMA: Record<Plataforma, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
};

/**
 * Que campos habilita cada plataforma. La UI lo consulta para no mostrar
 * controles que la API va a ignorar o rechazar.
 */
export const CAPACIDADES: Record<
  Plataforma,
  {
    altTextEnImagen: boolean;
    etiquetasConCoordenadas: boolean;
    ubicacion: boolean;
    primerComentario: boolean;
    segmentacionOrganica: boolean;
    etiquetaContenidoIA: boolean;
  }
> = {
  INSTAGRAM: {
    altTextEnImagen: true,
    etiquetasConCoordenadas: true,
    ubicacion: true,
    primerComentario: true,
    // Instagram organico no tiene segmentacion de publico: no existe en la API.
    segmentacionOrganica: false,
    etiquetaContenidoIA: true,
  },
  FACEBOOK: {
    altTextEnImagen: false,
    etiquetasConCoordenadas: false,
    ubicacion: true,
    primerComentario: true,
    // feed_targeting existe pero Meta discontinuo el targeting por intereses:
    // queda apagado hasta confirmar contra la API real que aporta algo.
    segmentacionOrganica: false,
    etiquetaContenidoIA: false,
  },
  TIKTOK: {
    altTextEnImagen: false,
    etiquetasConCoordenadas: false,
    ubicacion: false,
    // La Content Posting API no permite comentar el propio post.
    primerComentario: false,
    segmentacionOrganica: false,
    etiquetaContenidoIA: true,
  },
};
