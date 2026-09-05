import type { Plataforma, TipoPost } from "@/lib/validation/tipos";

/** Estado del formulario de carga, compartido por los cinco pasos. */

export interface CuentaDisponible {
  id: string;
  plataforma: Plataforma;
  nombreVisible: string;
}

export interface MedioCargado {
  id: string;
  tipo: "IMAGEN" | "VIDEO";
  urlPublica: string;
  mime: string;
  bytes: number;
  ancho: number | null;
  alto: number | null;
  duracionMs: number | null;
}

export interface EtiquetaEnFormulario {
  mediaAssetId: string;
  username: string;
  x: number | null;
  y: number | null;
}

export interface DestinoEnFormulario {
  socialAccountId: string;
  plataforma: Plataforma;
  caption: string;
  primerComentario: string | null;
  altText: string | null;
  isAiGenerated: boolean;
  locationId: string | null;
  locationNombre: string | null;
  config: {
    tiktok?: {
      titulo?: string;
      privacidad?: string;
      permitirComentarios?: boolean;
      permitirDuo?: boolean;
      permitirStitch?: boolean;
      brandOrganicToggle?: boolean;
      brandContentToggle?: boolean;
    };
  };
  etiquetas: EtiquetaEnFormulario[];
}

export interface EstadoFormulario {
  postId: string | null;
  tituloInterno: string;
  tipo: TipoPost | null;
  cuentasElegidas: string[];
  medios: MedioCargado[];
  destinos: DestinoEnFormulario[];
  /** Caption unico para todas las plataformas. */
  captionUnificado: boolean;
  captionBase: string;
  /** Fecha y hora en zona de la marca, como las escribe el usuario. */
  fecha: string;
  hora: string;
  modoPublicacion: "SIN_FECHA" | "PROGRAMAR" | "AHORA";
}

export function destinoVacio(
  socialAccountId: string,
  plataforma: Plataforma,
): DestinoEnFormulario {
  return {
    socialAccountId,
    plataforma,
    caption: "",
    primerComentario: null,
    altText: null,
    isAiGenerated: false,
    locationId: null,
    locationNombre: null,
    config:
      plataforma === "TIKTOK"
        ? {
            tiktok: {
              // Los valores reales se piden a creator_info al elegir la cuenta;
              // estos son los que TikTok usa por defecto mientras tanto.
              privacidad: "SELF_ONLY",
              permitirComentarios: true,
              permitirDuo: false,
              permitirStitch: false,
              brandOrganicToggle: false,
              brandContentToggle: false,
            },
          }
        : {},
    etiquetas: [],
  };
}

/**
 * Aplica el caption base a todos los destinos. Se llama cuando el usuario tiene
 * activado "usar el mismo texto para todas".
 */
export function propagarCaption(
  destinos: DestinoEnFormulario[],
  caption: string,
): DestinoEnFormulario[] {
  return destinos.map((d) => ({ ...d, caption }));
}
