"use client";

import { CalendarClock } from "lucide-react";
import { VistaPrevia } from "@/components/previews/vista-previa";
import { formatearLocal, desdeFormulario } from "@/lib/time/asuncion";
import { ETIQUETA_TIPO } from "@/lib/validation/tipos";
import type { CuentaDisponible, EstadoFormulario } from "./estado";

/**
 * Paso 5. Es la pantalla que mira el Jefe para aprobar, asi que muestra lo
 * mismo que va a salir: el texto truncado como lo trunca cada red, la
 * ubicacion, las etiquetas y el primer comentario.
 */
export function PasoVistaPrevia({
  cuentas,
  estado,
  zona,
}: {
  cuentas: CuentaDisponible[];
  estado: EstadoFormulario;
  zona: string;
}) {
  const programada =
    estado.modoPublicacion === "PROGRAMAR" && estado.fecha && estado.hora
      ? desdeFormulario(estado.fecha, estado.hora, zona)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4 text-sm">
        <span className="font-medium">{estado.tituloInterno || "Sin titulo"}</span>
        {estado.tipo && (
          <span className="text-muted-foreground">
            {ETIQUETA_TIPO[estado.tipo]}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-4" />
          {programada
            ? formatearLocal(programada, "d 'de' MMMM 'a las' HH:mm", zona)
            : estado.modoPublicacion === "AHORA"
              ? "Sale al aprobarse"
              : "Sin fecha"}
        </span>
      </div>

      <div className="flex flex-wrap gap-6">
        {estado.destinos.map((destino) => {
          const cuenta = cuentas.find((c) => c.id === destino.socialAccountId);

          return (
            <VistaPrevia
              key={destino.socialAccountId}
              datos={{
                plataforma: destino.plataforma,
                tipo: estado.tipo ?? "IG_FEED",
                nombreCuenta: cuenta?.nombreVisible ?? "cuenta",
                caption: destino.caption,
                ubicacion: destino.locationNombre,
                medios: estado.medios.map((m) => ({
                  id: m.id,
                  tipo: m.tipo,
                  urlPublica: m.urlPublica,
                })),
                etiquetas: destino.etiquetas,
                primerComentario: destino.primerComentario,
                esContenidoIA: destino.isAiGenerated,
                tituloTiktok: destino.config.tiktok?.titulo ?? null,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
