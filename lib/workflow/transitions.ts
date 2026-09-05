import type {
  AccionWorkflow,
  EfectosTransicion,
  EstadoPost,
  Rol,
} from "./types";

/** Quien puede pedir la accion. SISTEMA es el worker. */
export type Autorizado = Rol | "SISTEMA";

export interface Transicion {
  desde: EstadoPost;
  accion: AccionWorkflow;
  hacia: EstadoPost;
  autorizados: Autorizado[];
  /** El actor debe ser el autor del post. */
  requiereAutor?: boolean;
  /** El jefe no puede ejecutarla sobre su propio post (salvo flag de marca). */
  bloqueaAutoAprobacion?: boolean;
  requiereComentario?: boolean;
  requiereFecha?: boolean;
  efectos?: Partial<EfectosTransicion>;
}

export const EFECTOS_VACIOS: EfectosTransicion = {
  incrementarVersion: false,
  encolarJobs: false,
  cancelarJobs: false,
  registrarAprobacion: null,
  notificarAutor: false,
  sellarPublicacion: false,
  archivar: false,
};

const TODOS: Autorizado[] = ["CM", "JEFE", "ADMIN"];
const MANDO: Autorizado[] = ["JEFE", "ADMIN"];

/**
 * La tabla del pedido, como dato. Cualquier cambio de flujo se hace aca y los
 * tests lo cubren; ningun componente escribe `estado` a mano.
 */
export const TRANSICIONES: Transicion[] = [
  {
    desde: "BORRADOR",
    accion: "ENVIAR_A_REVISION",
    hacia: "EN_REVISION",
    autorizados: TODOS,
    requiereAutor: true,
  },
  {
    desde: "CAMBIOS_SOLICITADOS",
    accion: "ENVIAR_A_REVISION",
    hacia: "EN_REVISION",
    autorizados: TODOS,
    requiereAutor: true,
  },
  {
    desde: "EN_REVISION",
    accion: "APROBAR",
    hacia: "APROBADO",
    autorizados: MANDO,
    bloqueaAutoAprobacion: true,
    efectos: { registrarAprobacion: "APROBAR", notificarAutor: true },
  },
  {
    desde: "EN_REVISION",
    accion: "SOLICITAR_CAMBIOS",
    hacia: "CAMBIOS_SOLICITADOS",
    autorizados: MANDO,
    bloqueaAutoAprobacion: true,
    requiereComentario: true,
    efectos: { registrarAprobacion: "SOLICITAR_CAMBIOS", notificarAutor: true },
  },
  {
    desde: "APROBADO",
    accion: "PROGRAMAR",
    hacia: "PROGRAMADO",
    autorizados: TODOS,
    requiereFecha: true,
    efectos: { encolarJobs: true },
  },
  {
    desde: "APROBADO",
    accion: "PUBLICAR_AHORA",
    hacia: "PUBLICANDO",
    autorizados: TODOS,
    efectos: { encolarJobs: true },
  },
  {
    desde: "PROGRAMADO",
    accion: "TOMAR_JOB",
    hacia: "PUBLICANDO",
    autorizados: ["SISTEMA"],
  },
  {
    desde: "PROGRAMADO",
    accion: "CANCELAR_PROGRAMACION",
    hacia: "APROBADO",
    autorizados: TODOS,
    efectos: { cancelarJobs: true },
  },
  {
    desde: "PUBLICANDO",
    accion: "MARCAR_PUBLICADO",
    hacia: "PUBLICADO",
    autorizados: ["SISTEMA"],
    efectos: { sellarPublicacion: true, notificarAutor: true },
  },
  {
    desde: "PUBLICANDO",
    accion: "MARCAR_FALLIDO",
    hacia: "FALLIDO",
    autorizados: ["SISTEMA"],
    efectos: { notificarAutor: true },
  },
  {
    desde: "FALLIDO",
    accion: "REINTENTAR",
    hacia: "PROGRAMADO",
    autorizados: TODOS,
    efectos: { encolarJobs: true },
  },
  {
    desde: "PUBLICADO",
    accion: "ARCHIVAR",
    hacia: "PUBLICADO",
    autorizados: MANDO,
    efectos: { archivar: true },
  },
];

/** CANCELAR y EDITAR_CONTENIDO aplican desde varios estados: se generan. */
const ESTADOS_CANCELABLES: EstadoPost[] = [
  "BORRADOR",
  "EN_REVISION",
  "CAMBIOS_SOLICITADOS",
  "APROBADO",
  "PROGRAMADO",
  "PUBLICANDO",
  "FALLIDO",
];

for (const desde of ESTADOS_CANCELABLES) {
  TRANSICIONES.push({
    desde,
    accion: "CANCELAR",
    hacia: "CANCELADO",
    autorizados: MANDO,
    efectos: { cancelarJobs: true },
  });
}

/**
 * Editar contenido no siempre es una transicion: en BORRADOR y
 * CAMBIOS_SOLICITADOS el post se queda donde esta. En EN_REVISION, APROBADO y
 * PROGRAMADO vuelve a BORRADOR, porque no se aprueba una cosa y se publica otra.
 */
const EDICION: Array<[EstadoPost, EstadoPost, Partial<EfectosTransicion>]> = [
  ["BORRADOR", "BORRADOR", {}],
  ["CAMBIOS_SOLICITADOS", "CAMBIOS_SOLICITADOS", {}],
  ["EN_REVISION", "BORRADOR", { incrementarVersion: true }],
  ["APROBADO", "BORRADOR", { incrementarVersion: true }],
  ["PROGRAMADO", "BORRADOR", { incrementarVersion: true, cancelarJobs: true }],
  ["FALLIDO", "BORRADOR", { incrementarVersion: true, cancelarJobs: true }],
];

for (const [desde, hacia, efectos] of EDICION) {
  TRANSICIONES.push({
    desde,
    accion: "EDITAR_CONTENIDO",
    hacia,
    autorizados: TODOS,
    efectos,
  });
}

export function buscarTransicion(
  desde: EstadoPost,
  accion: AccionWorkflow,
): Transicion | undefined {
  return TRANSICIONES.find((t) => t.desde === desde && t.accion === accion);
}
