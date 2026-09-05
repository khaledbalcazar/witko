import {
  buscarTransicion,
  EFECTOS_VACIOS,
  type Autorizado,
  type Transicion,
} from "./transitions";
import {
  MINUTOS_MINIMOS_PROGRAMACION,
  type Actor,
  type CodigoRechazo,
  type EntradaTransicion,
  type EstadoPost,
  type ResultadoTransicion,
} from "./types";

/** Estados donde el contenido ya no se toca. */
const INMUTABLES: EstadoPost[] = ["PUBLICANDO", "PUBLICADO", "CANCELADO"];

function rechazo(codigo: CodigoRechazo, motivo: string): ResultadoTransicion {
  return { ok: false, codigo, motivo };
}

function credencial(actor: Actor): Autorizado {
  return actor.tipo === "SISTEMA" ? "SISTEMA" : actor.rol;
}

/**
 * Unico punto donde se decide si un post puede cambiar de estado.
 * Es una funcion pura: no toca la base ni el reloj. El caller
 * (`aplicarTransicion`) se encarga de persistir y de escribir el audit_log.
 */
export function evaluarTransicion(
  entrada: EntradaTransicion,
): ResultadoTransicion {
  const { accion, post, marca, actor, ahora } = entrada;

  if (post.archivadoAt) {
    return rechazo(
      "POST_ARCHIVADO",
      "Este post esta archivado y no admite cambios.",
    );
  }

  // La inmutabilidad se responde antes que la tabla, para dar un mensaje util
  // en vez de un generico "transicion invalida".
  if (accion === "EDITAR_CONTENIDO" && INMUTABLES.includes(post.estado)) {
    return rechazo(
      "POST_INMUTABLE",
      post.estado === "PUBLICADO"
        ? "Un post publicado no se edita. Podes archivarlo."
        : "No se puede editar un post en estado " + post.estado + ".",
    );
  }

  const transicion = buscarTransicion(post.estado, accion);
  if (!transicion) {
    return rechazo(
      "TRANSICION_INVALIDA",
      "No se puede " + accion + " un post en estado " + post.estado + ".",
    );
  }

  const fallaPermiso = verificarPermisos(transicion, entrada);
  if (fallaPermiso) return fallaPermiso;

  if (transicion.requiereComentario) {
    const comentario = (entrada.comentario ?? "").trim();
    if (!comentario) {
      return rechazo(
        "COMENTARIO_REQUERIDO",
        "Para devolver un post hay que explicar que cambiar.",
      );
    }
  }

  if (transicion.requiereFecha) {
    const fecha = entrada.scheduledAt;
    if (!fecha) {
      return rechazo("FECHA_REQUERIDA", "Elegi una fecha y hora de publicacion.");
    }
    const minimo = new Date(
      ahora.getTime() + MINUTOS_MINIMOS_PROGRAMACION * 60_000,
    );
    if (fecha.getTime() < minimo.getTime()) {
      return rechazo(
        "FECHA_MUY_PROXIMA",
        "La publicacion tiene que estar al menos " +
          MINUTOS_MINIMOS_PROGRAMACION +
          " minutos en el futuro.",
      );
    }
  }

  return {
    ok: true,
    estadoAnterior: post.estado,
    nuevoEstado: transicion.hacia,
    efectos: { ...EFECTOS_VACIOS, ...transicion.efectos },
  };
}

function verificarPermisos(
  transicion: Transicion,
  entrada: EntradaTransicion,
): ResultadoTransicion | null {
  const { actor, post, marca } = entrada;

  if (!transicion.autorizados.includes(credencial(actor))) {
    return rechazo(
      "ROL_NO_AUTORIZADO",
      actor.tipo === "SISTEMA"
        ? "Esta accion la hace una persona, no el worker."
        : "Tu rol no tiene permiso para esta accion.",
    );
  }

  if (actor.tipo === "SISTEMA") return null;

  if (!actor.esMiembro) {
    return rechazo("NO_ES_MIEMBRO", "No sos miembro de esta marca.");
  }

  if (transicion.requiereAutor && actor.id !== post.autorId) {
    return rechazo(
      "NO_ES_AUTOR",
      "Solo el autor puede enviar su publicacion a revision.",
    );
  }

  if (
    transicion.bloqueaAutoAprobacion &&
    actor.id === post.autorId &&
    !marca.permitirAutoAprobacion
  ) {
    return rechazo(
      "AUTO_APROBACION_PROHIBIDA",
      "No podes revisar una publicacion tuya. Pedile a otro jefe que la vea.",
    );
  }

  return null;
}
