"use client";

import { CalendarDays, CheckSquare, Link2, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatearLocal } from "@/lib/time/asuncion";
import { ETIQUETA_ESTADO } from "@/components/estado/estado-post";
import type { EstadoPost } from "@/lib/workflow/types";
import type { Etiqueta } from "./tablero";

export interface ItemChecklist {
  id: string;
  texto: string;
  hecho: boolean;
}

export interface ComentarioTarjeta {
  id: string;
  cuerpo: string;
  autorId: string;
  autorNombre: string;
  createdAt: string;
}

export interface Tarjeta {
  id: string;
  columnId: string;
  orden: number;
  titulo: string;
  descripcion: string | null;
  prioridad: "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
  dueAt: string | null;
  completadoAt: string | null;
  asignadoId: string | null;
  asignadoNombre: string | null;
  postId: string | null;
  postTitulo: string | null;
  postEstado: string | null;
  etiquetaIds: string[];
  checklist: ItemChecklist[];
  comentarios: ComentarioTarjeta[];
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
  onCompletar,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  zona: string;
  onAbrir: () => void;
  onCompletar: (hecha: boolean) => void;
}) {
  const suyas = etiquetas.filter((e) => tarjeta.etiquetaIds.includes(e.id));
  const hechos = tarjeta.checklist.filter((i) => i.hecho).length;
  const completada = tarjeta.completadoAt != null;

  const vencida =
    !completada &&
    tarjeta.dueAt != null &&
    new Date(tarjeta.dueAt).getTime() < Date.now();

  return (
    <Card
      onClick={onAbrir}
      className={cn(
        "cursor-pointer gap-2 p-3 shadow-none transition-shadow hover:shadow-sm",
        completada && "bg-emerald-50/60",
      )}
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

      <div className="flex items-start gap-2">
        {/* El clic en la casilla no tiene que abrir la tarjeta. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={completada}
          aria-label={
            completada
              ? "Marcar como pendiente: " + tarjeta.titulo
              : "Marcar como hecha: " + tarjeta.titulo
          }
          onClick={(e) => {
            e.stopPropagation();
            onCompletar(!completada);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
            completada
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-muted-foreground/40 hover:border-emerald-600",
          )}
        >
          {completada && (
            <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true">
              <path
                d="M20 6 9 17l-5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <p
          className={cn(
            "flex-1 text-sm",
            completada && "text-muted-foreground line-through",
          )}
        >
          {tarjeta.titulo}
        </p>
      </div>

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
          <span
            className={cn(
              "flex items-center gap-1",
              hechos === tarjeta.checklist.length && "text-emerald-700",
            )}
          >
            <CheckSquare className="size-3" />
            {hechos}/{tarjeta.checklist.length}
          </span>
        )}

        {tarjeta.comentarios.length > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {tarjeta.comentarios.length}
          </span>
        )}

        {tarjeta.dueAt && (
          <span
            className={cn(
              "flex items-center gap-1",
              vencida && "font-medium text-destructive",
              completada && "text-emerald-700",
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
