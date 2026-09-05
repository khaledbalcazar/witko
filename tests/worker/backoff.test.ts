import { describe, expect, it } from "vitest";
import {
  decidirReintento,
  limiteJobTrabado,
  MINUTOS_JOB_TRABADO,
} from "@/worker/backoff";

const AHORA = new Date("2026-03-10T14:00:00Z");

function minutosDesdeAhora(fecha: Date | null): number | null {
  if (!fecha) return null;
  return (fecha.getTime() - AHORA.getTime()) / 60_000;
}

describe("politica de reintentos", () => {
  it("el primer fallo se reintenta al minuto", () => {
    const d = decidirReintento({
      intentosRealizados: 1,
      maxIntentos: 3,
      reintentable: true,
      ahora: AHORA,
    });
    expect(d.reintentar).toBe(true);
    expect(minutosDesdeAhora(d.proximoIntentoEn)).toBe(1);
  });

  it("el segundo a los 5 minutos", () => {
    const d = decidirReintento({
      intentosRealizados: 2,
      maxIntentos: 3,
      reintentable: true,
      ahora: AHORA,
    });
    expect(minutosDesdeAhora(d.proximoIntentoEn)).toBe(5);
  });

  it("despues del tercer intento se da por perdido", () => {
    const d = decidirReintento({
      intentosRealizados: 3,
      maxIntentos: 3,
      reintentable: true,
      ahora: AHORA,
    });
    expect(d.reintentar).toBe(false);
    expect(d.proximoIntentoEn).toBeNull();
  });

  it("un error no reintentable corta en el primer intento", () => {
    const d = decidirReintento({
      intentosRealizados: 1,
      maxIntentos: 3,
      reintentable: false,
      ahora: AHORA,
    });
    expect(d.reintentar).toBe(false);
  });

  it("con mas intentos permitidos se mantiene en 15 minutos", () => {
    const d = decidirReintento({
      intentosRealizados: 5,
      maxIntentos: 8,
      reintentable: true,
      ahora: AHORA,
    });
    expect(minutosDesdeAhora(d.proximoIntentoEn)).toBe(15);
  });

  it("si la plataforma pide esperar mas, se respeta", () => {
    const dentroDeUnaHora = new Date(AHORA.getTime() + 60 * 60_000);
    const d = decidirReintento({
      intentosRealizados: 1,
      maxIntentos: 3,
      reintentable: true,
      ahora: AHORA,
      reintentarDespuesDe: dentroDeUnaHora,
    });
    expect(d.proximoIntentoEn?.toISOString()).toBe(
      dentroDeUnaHora.toISOString(),
    );
  });

  it("si la plataforma pide menos que la politica, manda la politica", () => {
    const enDiezSegundos = new Date(AHORA.getTime() + 10_000);
    const d = decidirReintento({
      intentosRealizados: 2,
      maxIntentos: 3,
      reintentable: true,
      ahora: AHORA,
      reintentarDespuesDe: enDiezSegundos,
    });
    expect(minutosDesdeAhora(d.proximoIntentoEn)).toBe(5);
  });
});

describe("jobs trabados", () => {
  it("el limite son 15 minutos hacia atras", () => {
    const limite = limiteJobTrabado(AHORA);
    expect((AHORA.getTime() - limite.getTime()) / 60_000).toBe(
      MINUTOS_JOB_TRABADO,
    );
  });
});
