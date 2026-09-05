"use client";

import { CalendarDays, CheckSquare, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatearLocal } from "@/lib/time/asuncion";
import { ETIQUETA_ESTADO } from "@/components/estado/estado-post";
import type { EstadoPost } from "@/lib/workflow/types";
import type { Etiqueta } from "./tablero";

export interface Tarjeta {
  id: string;
  columnId: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
  dueAt: string | null;
  asignadoId: string | null;
  asignadoNombre: string | null;
  postId: string | null;
  postTitulo: string | null;
  postEstado: string | null;
  etiquetaIds: string[];
  checklist: Array<{ id: string; texto: string; hecho: boolean }>;
}

export const COLOR_PRIORIDAD: Record<Tarjeta["prioridad"], string> = {
  BAJA: "bg-slate-100 text-slate-600",
  MEDIA: "bg-blue-100 text-blue-700",
  ALTA: "bg-amber-100 text-amber-800",
  URGENTE: "bg-red-100 text-red-700",
};

export function TarjetaTablero({
  tarjeta,
  etiquetas,
  zona,
  onAbrir,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  zona: string;
  onAbrir: () => void;
}) {
  const suyas = etiquetas.filter((e) => tarjeta.etiquetaIds.includes(e.id));
  const hechos = tarjeta.checklist.filter((i) => i.hecho).length;

  const vencida =
    tarjeta.dueAt != null && new Date(tarjeta.dueAt).getTime() < Date.now();

  return (
    <Card
      onClick={onAbrir}
      className="cursor-pointer gap-2 p-3 shadow-none transition-shadow hover:shadow-sm"
    >
      {suyas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suyas.map((e) => (
            <span
              key={e.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: e.color }}
            >
              {e.nombre}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm">{tarjeta.titulo}</p>

      {tarjeta.postTitulo && (
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Link2 className="size-3 shrink-0" />
          {tarjeta.postTitulo}
          {tarjeta.postEstado && (
            <span className="shrink-0">
              ({ETIQUETA_ESTADO[tarjeta.postEstado as EstadoPost]})
            </span>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            COLOR_PRIORIDAD[tarjeta.prioridad],
          )}
        >
          {tarjeta.prioridad.toLowerCase()}
        </span>

        {tarjeta.checklist.length > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare className="size-3" />
            {hechos}/{tarjeta.checklist.length}
          </span>
        )}

        {tarjeta.dueAt && (
          <span
            className={cn(
              "flex items-center gap-1",
              vencida && "font-medium text-destructive",
            )}
          >
            <CalendarDays className="size-3" />
            {formatearLocal(new Date(tarjeta.dueAt), "d/MM", zona)}
          </span>
        )}

        {tarjeta.asignadoNombre && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5">
            {tarjeta.asignadoNombre.split(" ")[0]}
          </span>
        )}
      </div>
    </Card>
  );
}
