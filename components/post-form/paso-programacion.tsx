"use client";

import { Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { desdeFormulario, etiquetaDesfase } from "@/lib/time/asuncion";
import { MINUTOS_MINIMOS_PROGRAMACION } from "@/lib/workflow/types";
import type { EstadoFormulario } from "./estado";

const OPCIONES = [
  {
    valor: "SIN_FECHA" as const,
    titulo: "Sin fecha todavia",
    detalle: "Queda aprobada y se programa despues.",
  },
  {
    valor: "PROGRAMAR" as const,
    titulo: "Programar",
    detalle: "Sale sola en la fecha y hora que elijas.",
  },
  {
    valor: "AHORA" as const,
    titulo: "Publicar apenas se apruebe",
    detalle: "Entra a la cola ni bien el jefe la apruebe.",
  },
];

/** Paso 4. Todo se elige en hora de Asuncion y se guarda en UTC. */
export function PasoProgramacion({
  estado,
  onCambio,
  zona,
}: {
  estado: EstadoFormulario;
  onCambio: (cambio: Partial<EstadoFormulario>) => void;
  zona: string;
}) {
  const utc =
    estado.modoPublicacion === "PROGRAMAR" && estado.fecha && estado.hora
      ? desdeFormulario(estado.fecha, estado.hora, zona)
      : null;

  const minimo = new Date(
    Date.now() + MINUTOS_MINIMOS_PROGRAMACION * 60_000,
  );
  const muyProxima = utc != null && utc.getTime() < minimo.getTime();

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => onCambio({ modoPublicacion: opcion.valor })}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors",
              estado.modoPublicacion === opcion.valor
                ? "border-primary bg-accent/50"
                : "hover:bg-accent/30",
            )}
          >
            <span className="block text-sm font-medium">{opcion.titulo}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {opcion.detalle}
            </span>
          </button>
        ))}
      </div>

      {estado.modoPublicacion === "PROGRAMAR" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={estado.fecha}
                onChange={(e) => onCambio({ fecha: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="time"
                value={estado.hora}
                onChange={(e) => onCambio({ hora: e.target.value })}
              />
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            Hora de Paraguay ({etiquetaDesfase(utc ?? new Date(), zona)}).
            {utc && (
              <>
                {" "}
                En UTC son las{" "}
                <span className="font-medium tabular-nums">
                  {utc.toISOString().slice(11, 16)}
                </span>{" "}
                del {utc.toISOString().slice(0, 10)}.
              </>
            )}
          </p>

          {muyProxima && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">
                La publicacion tiene que quedar al menos{" "}
                {MINUTOS_MINIMOS_PROGRAMACION} minutos en el futuro. Todavia
                falta que el jefe la apruebe.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {estado.modoPublicacion === "AHORA" && (
        <Alert>
          <AlertDescription className="text-sm">
            Igual pasa por aprobacion: nada sale sin que el jefe lo apruebe.
            Apenas apruebe, entra a la cola de publicacion.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
