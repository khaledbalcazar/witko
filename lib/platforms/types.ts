import type {
  Plataforma,
  TipoMedia,
  TipoPost,
} from "@/lib/validation/tipos";

/**
 * Contrato unico de las plataformas.
 *
 * El worker no sabe si esta hablando con Instagram, con TikTok o con el mock:
 * despacha contra esta interfaz. Los DTO son planos a proposito, sin tipos de
 * Drizzle, para que los tests puedan armarlos a mano.
 */

export interface CuentaSocial {
  id: string;
  brandId: string;
  plataforma: Plataforma;
  externalAccountId: string;
  nombreVisible: string;
  /** Ya descifrado. Solo existe en memoria del servidor o del worker. */
  accessToken: string | null;
  refreshToken: string | null;
  expiraEn: Date | null;
  metadata: Record<string, unknown> | null;
}

export interface MediaParaPublicar {
  id: string;
  orden: number;
  tipo: TipoMedia;
  urlPublica: string;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  duracionMs: number | null;
  /** Etiquetas de usuario que aplican a este archivo en este destino. */
  etiquetas: EtiquetaUsuario[];
}

export interface EtiquetaUsuario {
  username: string;
  /** Solo Instagram, y solo en imagenes y stories. */
  x: number | null;
  y: number | null;
}

export interface DestinoParaPublicar {
  id: string;
  postId: string;
  tipo: TipoPost;
  plataforma: Plataforma;
  cuenta: CuentaSocial;
  caption: string;
  primerComentario: string | null;
  altText: string | null;
  isAiGenerated: boolean;
  locationId: string | null;
  config: ConfigDestino;
  /** Container ya creado en un intento anterior, si lo hubo. */
  externalContainerId: string | null;
  externalMediaId: string | null;
}

/** Opciones especificas por plataforma, guardadas en post_targets.config. */
export interface ConfigDestino {
  tiktok?: {
    titulo?: string;
    privacidad?: string;
    permitirComentarios?: boolean;
    permitirDuo?: boolean;
    permitirStitch?: boolean;
    brandOrganicToggle?: boolean;
    brandContentToggle?: boolean;
    modo?: "MEDIA_UPLOAD" | "DIRECT_POST";
  };
  facebook?: {
    feedTargeting?: Record<string, unknown>;
  };
}

/* ------------------------------------------------------------------ */

export interface ProblemaValidacion {
  campo: string;
  mensaje: string;
  /** AVISO no impide publicar; ERROR si. */
  nivel: "ERROR" | "AVISO";
}

export interface ResultadoValidacion {
  ok: boolean;
  problemas: ProblemaValidacion[];
}

export type ResultadoPublicacion =
  | {
      ok: true;
      externalMediaId: string;
      permalink: string | null;
      /** Aviso para mostrar al CM, por ejemplo que el video quedo privado. */
      advertencia?: string;
    }
  | {
      ok: false;
      codigo: string;
      mensaje: string;
      /** Si es false, reintentar no sirve: el job va directo a ERROR. */
      reintentable: boolean;
      /** Cuando la plataforma dice desde cuando se puede volver a intentar. */
      reintentarDespuesDe?: Date;
    };

export interface EstadoCuota {
  /** Si es false, el worker reprograma el job en vez de fallar. */
  disponible: boolean;
  usados: number;
  limite: number;
  /** Momento a partir del cual conviene reintentar. */
  reintentarDespuesDe?: Date;
  motivo?: string;
}

export type ResultadoToken =
  | { ok: true; accessToken: string; expiraEn: Date | null; cambio: boolean }
  | { ok: false; mensaje: string };

/** Progreso persistido entre pasos, para poder retomar tras un reinicio. */
export interface RegistroProgreso {
  guardarContainer(destinoId: string, containerId: string): Promise<void>;
}

export interface PlatformAdapter {
  readonly plataforma: Plataforma;

  /** Chequeos que se pueden hacer sin llamar a la API. */
  validate(
    destino: DestinoParaPublicar,
    media: MediaParaPublicar[],
  ): ResultadoValidacion;

  publish(
    destino: DestinoParaPublicar,
    media: MediaParaPublicar[],
    progreso?: RegistroProgreso,
  ): Promise<ResultadoPublicacion>;

  checkQuota(cuenta: CuentaSocial): Promise<EstadoCuota>;

  refreshToken(cuenta: CuentaSocial): Promise<ResultadoToken>;
}
