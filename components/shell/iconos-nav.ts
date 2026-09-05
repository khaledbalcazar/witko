import {
  CalendarDays,
  CheckCircle2,
  KanbanSquare,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Iconos de la navegacion, resueltos por clave.
 *
 * El layout es un Server Component y la barra lateral es cliente. Un componente
 * de React es una funcion, y las funciones no cruzan esa frontera: por eso las
 * props llevan una clave de texto y el icono se resuelve de este lado.
 */

export type ClaveIcono =
  | "inicio"
  | "tablero"
  | "calendario"
  | "aprobaciones"
  | "administracion";

export const ICONOS_NAV: Record<ClaveIcono, LucideIcon> = {
  inicio: LayoutDashboard,
  tablero: KanbanSquare,
  calendario: CalendarDays,
  aprobaciones: CheckCircle2,
  administracion: Settings,
};

export interface EnlaceNav {
  href: string;
  etiqueta: string;
  icono: ClaveIcono;
  insignia?: number;
}
