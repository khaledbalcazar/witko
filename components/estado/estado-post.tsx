import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EstadoPost } from "@/lib/workflow/types";

/**
 * Convencion de color de estados, usada en todas las pantallas: listado,
 * calendario, tablero y bandeja de aprobacion. Vive en un solo lugar para que
 * un post en revision se vea igual en todas.
 */

export const ETIQUETA_ESTADO: Record<EstadoPost, string> = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revision",
  CAMBIOS_SOLICITADOS: "Con cambios pedidos",
  APROBADO: "Aprobado",
  PROGRAMADO: "Programado",
  PUBLICANDO: "Publicando",
  PUBLICADO: "Publicado",
  FALLIDO: "Fallido",
  CANCELADO: "Cancelado",
};

export const COLOR_ESTADO: Record<EstadoPost, string> = {
  BORRADOR: "bg-slate-100 text-slate-700 border-slate-200",
  EN_REVISION: "bg-amber-100 text-amber-800 border-amber-200",
  CAMBIOS_SOLICITADOS: "bg-orange-100 text-orange-800 border-orange-200",
  APROBADO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PROGRAMADO: "bg-blue-100 text-blue-800 border-blue-200",
  PUBLICANDO: "bg-violet-100 text-violet-800 border-violet-200",
  PUBLICADO: "bg-zinc-100 text-zinc-700 border-zinc-200",
  FALLIDO: "bg-red-100 text-red-800 border-red-200",
  CANCELADO: "bg-neutral-100 text-neutral-500 border-neutral-200 line-through",
};

/** Barra lateral de color para el calendario y las tarjetas del tablero. */
export const BARRA_ESTADO: Record<EstadoPost, string> = {
  BORRADOR: "bg-slate-400",
  EN_REVISION: "bg-amber-500",
  CAMBIOS_SOLICITADOS: "bg-orange-500",
  APROBADO: "bg-emerald-500",
  PROGRAMADO: "bg-blue-500",
  PUBLICANDO: "bg-violet-500",
  PUBLICADO: "bg-zinc-400",
  FALLIDO: "bg-red-500",
  CANCELADO: "bg-neutral-300",
};

export function EstadoPostBadge({
  estado,
  className,
}: {
  estado: EstadoPost;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(COLOR_ESTADO[estado], "font-medium", className)}
    >
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  );
}
