import { format, toZonedTime, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

/**
 * Unica puerta entre la hora local del equipo y UTC.
 *
 * En la base todo es `timestamptz` en UTC. En la pantalla todo es hora de
 * Asuncion. Ninguna otra parte del codigo hace conversiones a mano.
 *
 * Paraguay dejo de aplicar horario de verano en 2024 (UTC-3 fijo), pero el
 * calculo va contra la base de zonas horarias del sistema igual, para que si
 * la regla cambia no haya que tocar nada.
 */

export const ZONA_POR_DEFECTO = "America/Asuncion";

/** Un instante en UTC leido como hora de pared en la zona de la marca. */
export function aHoraLocal(utc: Date, zona = ZONA_POR_DEFECTO): Date {
  return toZonedTime(utc, zona);
}

/** Lo que el usuario eligio en el selector (hora local) convertido a UTC. */
export function aUtc(horaLocal: Date, zona = ZONA_POR_DEFECTO): Date {
  return fromZonedTime(horaLocal, zona);
}

/**
 * Construye un instante UTC a partir de los strings del formulario.
 * `fecha` viene como "2026-03-10" y `hora` como "14:30".
 */
export function desdeFormulario(
  fecha: string,
  hora: string,
  zona = ZONA_POR_DEFECTO,
): Date {
  return fromZonedTime(fecha + "T" + hora + ":00", zona);
}

export function formatearLocal(
  utc: Date,
  patron = "d 'de' MMMM 'a las' HH:mm",
  zona = ZONA_POR_DEFECTO,
): string {
  return format(toZonedTime(utc, zona), patron, { timeZone: zona, locale: es });
}

/** "10/03/2026 14:30" para tablas y listados. */
export function formatearCorto(utc: Date, zona = ZONA_POR_DEFECTO): string {
  return formatearLocal(utc, "dd/MM/yyyy HH:mm", zona);
}

/** El desfase visible que se muestra al lado del selector, ej "UTC-3". */
export function etiquetaDesfase(utc: Date, zona = ZONA_POR_DEFECTO): string {
  const offset = format(toZonedTime(utc, zona), "xxx", { timeZone: zona });
  if (offset === "Z") return "UTC";
  const [horas, minutos] = offset.split(":");
  const signo = horas.startsWith("-") ? "-" : "+";
  const h = String(Math.abs(Number(horas)));
  return "UTC" + signo + h + (minutos === "00" ? "" : ":" + minutos);
}

/** Partes sueltas para llenar los inputs date y time del formulario. */
export function partesFormulario(
  utc: Date,
  zona = ZONA_POR_DEFECTO,
): { fecha: string; hora: string } {
  const local = toZonedTime(utc, zona);
  return {
    fecha: format(local, "yyyy-MM-dd", { timeZone: zona }),
    hora: format(local, "HH:mm", { timeZone: zona }),
  };
}
