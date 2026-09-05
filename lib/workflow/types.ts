/**
 * Tipos de la maquina de estados. Viven aparte de la implementacion para que
 * los tests, los route handlers y el worker hablen el mismo idioma.
 */

export type Rol = "CM" | "JEFE" | "ADMIN";

export type EstadoPost =
  | "BORRADOR"
  | "EN_REVISION"
  | "CAMBIOS_SOLICITADOS"
  | "APROBADO"
  | "PROGRAMADO"
  | "PUBLICANDO"
  | "PUBLICADO"
  | "FALLIDO"
  | "CANCELADO";

export type AccionWorkflow =
  | "ENVIAR_A_REVISION"
  | "APROBAR"
  | "SOLICITAR_CAMBIOS"
  | "PROGRAMAR"
  | "PUBLICAR_AHORA"
  | "TOMAR_JOB"
  | "CANCELAR_PROGRAMACION"
  | "MARCAR_PUBLICADO"
  | "MARCAR_FALLIDO"
  | "REINTENTAR"
  | "CANCELAR"
  | "EDITAR_CONTENIDO"
  | "ARCHIVAR";

/** Quien pide la transicion. El worker usa ACTOR_SISTEMA. */
export type Actor =
  | { tipo: "USUARIO"; id: string; rol: Rol; esMiembro: boolean }
  | { tipo: "SISTEMA" };

export interface PostSnapshot {
  id: string;
  estado: EstadoPost;
  autorId: string;
  brandId: string;
  version: number;
  scheduledAt: Date | null;
  archivadoAt: Date | null;
}

export interface MarcaSnapshot {
  id: string;
  permitirAutoAprobacion: boolean;
}

export interface EntradaTransicion {
  accion: AccionWorkflow;
  post: PostSnapshot;
  marca: MarcaSnapshot;
  actor: Actor;
  /** Obligatorio en SOLICITAR_CAMBIOS. */
  comentario?: string | null;
  /** Obligatorio en PROGRAMAR. */
  scheduledAt?: Date | null;
  /** Se inyecta para que los tests no dependan del reloj real. */
  ahora: Date;
}

export type CodigoRechazo =
  | "TRANSICION_INVALIDA"
  | "ROL_NO_AUTORIZADO"
  | "NO_ES_MIEMBRO"
  | "NO_ES_AUTOR"
  | "AUTO_APROBACION_PROHIBIDA"
  | "COMENTARIO_REQUERIDO"
  | "FECHA_REQUERIDA"
  | "FECHA_MUY_PROXIMA"
  | "POST_INMUTABLE"
  | "POST_ARCHIVADO";

/** Efectos secundarios que el caller debe aplicar dentro de la misma transaccion. */
export interface EfectosTransicion {
  /** Sube la version del post: la edicion invalida la aprobacion anterior. */
  incrementarVersion: boolean;
  /** Encolar publish_jobs para cada destino. */
  encolarJobs: boolean;
  /** Cancelar los publish_jobs pendientes del post. */
  cancelarJobs: boolean;
  /** Registrar una fila en approvals. */
  registrarAprobacion: "APROBAR" | "SOLICITAR_CAMBIOS" | null;
  /** Avisar al autor por el Notifier. */
  notificarAutor: boolean;
  /** Sellar published_at. */
  sellarPublicacion: boolean;
  /** Sellar archivado_at. */
  archivar: boolean;
}

export type ResultadoTransicion =
  | {
      ok: true;
      estadoAnterior: EstadoPost;
      nuevoEstado: EstadoPost;
      efectos: EfectosTransicion;
    }
  | { ok: false; codigo: CodigoRechazo; motivo: string };

export const ACTOR_SISTEMA: Actor = { tipo: "SISTEMA" };

/** Minutos minimos entre ahora y una fecha programada. */
export const MINUTOS_MINIMOS_PROGRAMACION = 10;
