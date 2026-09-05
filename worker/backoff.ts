/**
 * Reprogramacion de jobs fallidos: 1, 5 y 15 minutos.
 *
 * Es una funcion pura para poder testear la politica sin base de datos ni
 * esperas reales.
 */

export const ESPERAS_MINUTOS = [1, 5, 15];

/** Minutos que un job puede quedarse EN_CURSO antes de considerarse trabado. */
export const MINUTOS_JOB_TRABADO = 15;

export interface DecisionReintento {
  /** true si hay que volver a intentar, false si el job se da por perdido. */
  reintentar: boolean;
  proximoIntentoEn: Date | null;
  esperaMinutos: number | null;
}

export function decidirReintento(params: {
  intentosRealizados: number;
  maxIntentos: number;
  reintentable: boolean;
  ahora: Date;
  /** Si la plataforma dijo desde cuando reintentar, manda ese valor. */
  reintentarDespuesDe?: Date | null;
}): DecisionReintento {
  const { intentosRealizados, maxIntentos, reintentable, ahora } = params;

  if (!reintentable) {
    return { reintentar: false, proximoIntentoEn: null, esperaMinutos: null };
  }

  if (intentosRealizados >= maxIntentos) {
    return { reintentar: false, proximoIntentoEn: null, esperaMinutos: null };
  }

  const indice = Math.min(intentosRealizados - 1, ESPERAS_MINUTOS.length - 1);
  const esperaMinutos = ESPERAS_MINUTOS[Math.max(indice, 0)];
  const porPolitica = new Date(ahora.getTime() + esperaMinutos * 60_000);

  // Si la plataforma pidio esperar mas, se le hace caso: reintentar antes solo
  // consume cuota y vuelve a fallar.
  const proximoIntentoEn =
    params.reintentarDespuesDe && params.reintentarDespuesDe > porPolitica
      ? params.reintentarDespuesDe
      : porPolitica;

  return { reintentar: true, proximoIntentoEn, esperaMinutos };
}

/** Momento a partir del cual un job EN_CURSO se considera abandonado. */
export function limiteJobTrabado(ahora: Date): Date {
  return new Date(ahora.getTime() - MINUTOS_JOB_TRABADO * 60_000);
}
