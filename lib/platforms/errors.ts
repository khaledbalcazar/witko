import type { Plataforma } from "@/lib/validation/tipos";

/**
 * Traduccion de los codigos de error de las plataformas a algo que le sirva a
 * un community manager.
 *
 * `unaudited_client_can_only_post_to_private_accounts` no le dice nada a nadie.
 * "Tu app de TikTok todavia no paso la auditoria, el video se publico como
 * privado" si, y ademas dice que hacer.
 */

export interface ErrorTraducido {
  mensaje: string;
  reintentable: boolean;
  /** Que puede hacer el usuario. Se muestra debajo del mensaje. */
  sugerencia?: string;
}

const META: Record<string, ErrorTraducido> = {
  "4": {
    mensaje: "Instagram esta limitando las publicaciones por volumen.",
    reintentable: true,
    sugerencia: "El sistema reintenta solo en unos minutos.",
  },
  "17": {
    mensaje: "Se alcanzo el limite de peticiones a la API por ahora.",
    reintentable: true,
    sugerencia: "El sistema reintenta solo.",
  },
  "10": {
    mensaje: "La app no tiene permiso para publicar en esta cuenta.",
    reintentable: false,
    sugerencia:
      "Un administrador tiene que reconectar la cuenta desde Cuentas y conexiones.",
  },
  "190": {
    mensaje: "El token de acceso vencio o fue revocado.",
    reintentable: false,
    sugerencia: "Reconecta la cuenta desde Cuentas y conexiones.",
  },
  "200": {
    mensaje: "Faltan permisos sobre la Pagina o la cuenta de Instagram.",
    reintentable: false,
    sugerencia:
      "Revisa en Business Manager que la cuenta tenga control total asignado.",
  },
  "324": {
    mensaje: "Instagram rechazo la imagen por su tamano o formato.",
    reintentable: false,
    sugerencia: "Volve a subir el archivo en JPG, de menos de 8 MB.",
  },
  "352": {
    mensaje: "El formato del video no es compatible.",
    reintentable: false,
    sugerencia: "Exportalo en MP4 con codec H.264 y audio AAC.",
  },
  "2207026": {
    mensaje: "El video no cumple los requisitos de Instagram.",
    reintentable: false,
    sugerencia: "Revisa duracion, proporcion y peso del archivo.",
  },
  "9007": {
    mensaje: "El contenedor de la publicacion expiro antes de publicarse.",
    reintentable: true,
    sugerencia: "El sistema lo vuelve a crear desde cero.",
  },
  "36003": {
    mensaje: "Una de las cuentas etiquetadas no existe o no permite etiquetas.",
    reintentable: false,
    sugerencia: "Sacá la etiqueta y volve a intentar.",
  },
};

const TIKTOK: Record<string, ErrorTraducido> = {
  unaudited_client_can_only_post_to_private_accounts: {
    mensaje:
      "La app de TikTok todavia no paso la auditoria de contenido, asi que el video se publica como privado.",
    reintentable: false,
    sugerencia:
      "Entra a TikTok desde el celular y cambia la privacidad a mano, o usa el modo de inbox hasta que se apruebe la auditoria.",
  },
  spam_risk_too_many_posts: {
    mensaje: "TikTok bloqueo la publicacion por demasiados posts seguidos.",
    reintentable: true,
    sugerencia: "El sistema reintenta mas tarde.",
  },
  spam_risk_user_banned_from_posting: {
    mensaje: "TikTok tiene bloqueada la publicacion para esta cuenta.",
    reintentable: false,
    sugerencia: "Revisa el estado de la cuenta en la app de TikTok.",
  },
  reached_active_user_cap: {
    mensaje: "Se alcanzo el limite diario de publicaciones de TikTok.",
    reintentable: true,
    sugerencia: "El sistema reintenta cuando se libere la cuota.",
  },
  file_format_check_failed: {
    mensaje: "TikTok rechazo el formato del archivo.",
    reintentable: false,
    sugerencia: "Exportalo en MP4 (H.264 + AAC) y volve a subirlo.",
  },
  duration_check_failed: {
    mensaje: "El video dura mas de lo que permite esta cuenta de TikTok.",
    reintentable: false,
    sugerencia: "Recortalo y volve a subirlo.",
  },
  frame_rate_check_failed: {
    mensaje: "La tasa de cuadros del video no es compatible con TikTok.",
    reintentable: false,
    sugerencia: "Exportalo entre 23 y 60 fps.",
  },
  picture_size_check_failed: {
    mensaje: "El tamano de una de las imagenes no es compatible.",
    reintentable: false,
  },
  access_token_invalid: {
    mensaje: "El token de TikTok vencio o fue revocado.",
    reintentable: false,
    sugerencia: "Reconecta la cuenta desde Cuentas y conexiones.",
  },
  rate_limit_exceeded: {
    mensaje: "Se supero el limite de peticiones de TikTok.",
    reintentable: true,
    sugerencia: "El sistema reintenta solo.",
  },
};

const GENERICO_REINTENTABLE: ErrorTraducido = {
  mensaje: "La plataforma no respondio. Puede ser un problema momentaneo.",
  reintentable: true,
  sugerencia: "El sistema reintenta automaticamente.",
};

/** Errores de red y de servidor: siempre vale la pena reintentar. */
export function esFalloTransitorio(status: number): boolean {
  return status === 429 || status >= 500;
}

export function traducirError(
  plataforma: Plataforma,
  codigo: string | number | null | undefined,
  mensajeCrudo?: string | null,
): ErrorTraducido {
  const clave = String(codigo ?? "");
  const tabla = plataforma === "TIKTOK" ? TIKTOK : META;
  const conocido = tabla[clave];

  if (conocido) return conocido;

  if (!clave) return GENERICO_REINTENTABLE;

  // Un codigo desconocido se muestra tal cual pero no se reintenta a ciegas:
  // si el error es de contenido, reintentar solo repite el mismo fallo.
  return {
    mensaje:
      "La plataforma rechazo la publicacion" +
      (mensajeCrudo ? ": " + mensajeCrudo : ".") +
      " (codigo " +
      clave +
      ")",
    reintentable: false,
    sugerencia:
      "Si no queda claro que cambiar, pasale el codigo de error a quien administra el sistema.",
  };
}
