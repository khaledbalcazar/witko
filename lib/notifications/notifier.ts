/**
 * Interfaz de notificaciones.
 *
 * En Fase 0 la implementa `ConsoleNotifier`, porque Resend necesita un dominio
 * verificado y el flujo de aprobacion no puede esperar a un registro DNS.
 * Cambiar a Resend es cambiar la variable NOTIFIER, sin tocar el resto.
 */

export type TipoNotificacion =
  | "POST_APROBADO"
  | "POST_DEVUELTO"
  | "POST_PUBLICADO"
  | "POST_FALLIDO"
  | "TAREA_ASIGNADA";

export interface Notificacion {
  tipo: TipoNotificacion;
  /** Email del destinatario. */
  para: string;
  nombreDestinatario: string;
  asunto: string;
  cuerpo: string;
  /** Link absoluto a la pantalla correspondiente. */
  enlace?: string;
}

export interface Notifier {
  enviar(notificacion: Notificacion): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  async enviar(n: Notificacion): Promise<void> {
    console.log(
      "\n[notificacion] " +
        n.tipo +
        "\n  para: " +
        n.nombreDestinatario +
        " <" +
        n.para +
        ">\n  asunto: " +
        n.asunto +
        "\n  " +
        n.cuerpo +
        (n.enlace ? "\n  enlace: " + n.enlace : "") +
        "\n",
    );
  }
}

/** Descarta todo. Para los tests. */
export class NullNotifier implements Notifier {
  readonly enviadas: Notificacion[] = [];
  async enviar(n: Notificacion): Promise<void> {
    this.enviadas.push(n);
  }
}

let instancia: Notifier | null = null;

export function notifier(): Notifier {
  if (instancia) return instancia;
  // Cuando exista ResendNotifier (Fase 1), aca se elige segun process.env.NOTIFIER.
  instancia = new ConsoleNotifier();
  return instancia;
}

export function setNotifier(n: Notifier): void {
  instancia = n;
}
