import type { Plataforma } from "@/lib/validation/tipos";
import { validarDestino } from "./validacion-comun";
import type {
  CuentaSocial,
  DestinoParaPublicar,
  EstadoCuota,
  MediaParaPublicar,
  PlatformAdapter,
  RegistroProgreso,
  ResultadoPublicacion,
  ResultadoToken,
  ResultadoValidacion,
} from "./types";

/**
 * Adaptador simulado. Es el que corre en Fase 0 y en todos los tests.
 *
 * Hace exactamente lo que haria el real (valida, respeta la cuota, guarda el
 * container antes de publicar) pero sin salir a internet, para poder probar el
 * flujo completo mientras Meta y TikTok revisan las apps.
 */

export interface OpcionesMock {
  /** Probabilidad de fallo por intento, entre 0 y 1. */
  tasaFallo?: number;
  /** Si el fallo simulado es reintentable. */
  falloReintentable?: boolean;
  /** Demora simulada de la llamada, en ms. */
  demoraMs?: number;
  /** Cuota disponible. Si es 0, el worker deberia reprogramar. */
  cuotaDisponible?: number;
  cuotaLimite?: number;
  /** Fuente de aleatoriedad, inyectable para tests deterministas. */
  random?: () => number;
  /** Reloj inyectable. */
  ahora?: () => Date;
}

export class MockAdapter implements PlatformAdapter {
  readonly plataforma: Plataforma;
  private readonly opciones: Required<OpcionesMock>;
  /** Cuenta de publicaciones simuladas por cuenta, para la cuota. */
  private readonly publicadosPorCuenta = new Map<string, number>();

  constructor(plataforma: Plataforma, opciones: OpcionesMock = {}) {
    this.plataforma = plataforma;
    this.opciones = {
      tasaFallo: opciones.tasaFallo ?? 0,
      falloReintentable: opciones.falloReintentable ?? true,
      demoraMs: opciones.demoraMs ?? 0,
      cuotaDisponible: opciones.cuotaDisponible ?? 100,
      cuotaLimite: opciones.cuotaLimite ?? 100,
      random: opciones.random ?? Math.random,
      ahora: opciones.ahora ?? (() => new Date()),
    };
  }

  validate(
    destino: DestinoParaPublicar,
    media: MediaParaPublicar[],
  ): ResultadoValidacion {
    return validarDestino(destino, media);
  }

  async publish(
    destino: DestinoParaPublicar,
    media: MediaParaPublicar[],
    progreso?: RegistroProgreso,
  ): Promise<ResultadoPublicacion> {
    // Idempotencia: si ya se publico, no se vuelve a publicar nunca.
    if (destino.externalMediaId) {
      return {
        ok: true,
        externalMediaId: destino.externalMediaId,
        permalink: this.permalink(destino, destino.externalMediaId),
      };
    }

    const validacion = this.validate(destino, media);
    const errores = validacion.problemas.filter((p) => p.nivel === "ERROR");
    if (errores.length > 0) {
      return {
        ok: false,
        codigo: "VALIDACION_LOCAL",
        mensaje: errores.map((e) => e.mensaje).join(" "),
        reintentable: false,
      };
    }

    await this.demorar();

    if (this.opciones.random() < this.opciones.tasaFallo) {
      return {
        ok: false,
        codigo: this.opciones.falloReintentable ? "SIMULADO_TEMPORAL" : "SIMULADO_FATAL",
        mensaje: this.opciones.falloReintentable
          ? "Fallo simulado de la plataforma. El sistema reintenta solo."
          : "Fallo simulado permanente: la plataforma rechazo la publicacion.",
        reintentable: this.opciones.falloReintentable,
      };
    }

    // Igual que Instagram: primero el container, despues la publicacion.
    // Se guarda el container antes de "publicar" para que un reinicio del
    // worker en el medio no genere una publicacion duplicada.
    const containerId =
      destino.externalContainerId ?? "mock-container-" + destino.id;
    if (!destino.externalContainerId && progreso) {
      await progreso.guardarContainer(destino.id, containerId);
    }

    await this.demorar();

    const externalMediaId =
      "mock-" +
      this.plataforma.toLowerCase() +
      "-" +
      destino.id.slice(0, 8) +
      "-" +
      this.opciones.ahora().getTime();

    const usados = (this.publicadosPorCuenta.get(destino.cuenta.id) ?? 0) + 1;
    this.publicadosPorCuenta.set(destino.cuenta.id, usados);

    const advertencia = this.advertenciaTiktok(destino);

    return {
      ok: true,
      externalMediaId,
      permalink: this.permalink(destino, externalMediaId),
      ...(advertencia ? { advertencia } : {}),
    };
  }

  async checkQuota(cuenta: CuentaSocial): Promise<EstadoCuota> {
    const usados = this.publicadosPorCuenta.get(cuenta.id) ?? 0;
    const limite = this.opciones.cuotaLimite;
    const disponible =
      this.opciones.cuotaDisponible > 0 && usados < limite;

    return {
      disponible,
      usados,
      limite,
      ...(disponible
        ? {}
        : {
            reintentarDespuesDe: new Date(
              this.opciones.ahora().getTime() + 60 * 60 * 1000,
            ),
            motivo:
              "Cuota simulada agotada: " + usados + " de " + limite + " en 24 horas.",
          }),
    };
  }

  async refreshToken(cuenta: CuentaSocial): Promise<ResultadoToken> {
    return {
      ok: true,
      accessToken: cuenta.accessToken ?? "mock-token",
      expiraEn: null,
      cambio: false,
    };
  }

  private advertenciaTiktok(destino: DestinoParaPublicar): string | undefined {
    if (destino.plataforma !== "TIKTOK") return undefined;
    if (destino.config.tiktok?.modo === "DIRECT_POST") return undefined;
    return "El video quedo en el inbox de TikTok. Hay que abrir la app para terminar de publicarlo.";
  }

  private permalink(destino: DestinoParaPublicar, id: string): string {
    const usuario = destino.cuenta.nombreVisible
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    switch (destino.plataforma) {
      case "INSTAGRAM":
        return "https://instagram.com/p/" + id;
      case "FACEBOOK":
        return "https://facebook.com/" + usuario + "/posts/" + id;
      case "TIKTOK":
        return "https://tiktok.com/@" + usuario + "/video/" + id;
    }
  }

  private demorar(): Promise<void> {
    if (this.opciones.demoraMs <= 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, this.opciones.demoraMs));
  }
}
