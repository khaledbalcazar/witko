"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ETIQUETA_TIPO,
  PLATAFORMA_DE_TIPO,
  TIPOS_POR_PLATAFORMA,
  type TipoPost,
} from "@/lib/validation/tipos";
import { LIMITES } from "@/lib/validation/media-limits";
import { ICONO_PLATAFORMA } from "@/components/iconos-redes";
import { destinoVacio, type CuentaDisponible, type EstadoFormulario } from "./estado";

/**
 * Paso 1. Elegir cuentas define que tipos de publicacion existen: un carrusel
 * no tiene sentido si el unico destino es TikTok.
 */
export function PasoDestinos({
  cuentas,
  estado,
  onCambio,
  bloqueado,
}: {
  cuentas: CuentaDisponible[];
  estado: EstadoFormulario;
  onCambio: (cambio: Partial<EstadoFormulario>) => void;
  bloqueado: boolean;
}) {
  const plataformasElegidas = new Set(
    cuentas
      .filter((c) => estado.cuentasElegidas.includes(c.id))
      .map((c) => c.plataforma),
  );

  const tiposDisponibles: TipoPost[] = [...plataformasElegidas].flatMap(
    (p) => TIPOS_POR_PLATAFORMA[p],
  );

  function alternarCuenta(cuenta: CuentaDisponible) {
    const yaEsta = estado.cuentasElegidas.includes(cuenta.id);
    const cuentasElegidas = yaEsta
      ? estado.cuentasElegidas.filter((id) => id !== cuenta.id)
      : [...estado.cuentasElegidas, cuenta.id];

    const destinos = yaEsta
      ? estado.destinos.filter((d) => d.socialAccountId !== cuenta.id)
      : [...estado.destinos, destinoVacio(cuenta.id, cuenta.plataforma)];

    // Si el tipo elegido dejo de ser valido con las cuentas nuevas, se limpia.
    const plataformas = new Set(
      cuentas
        .filter((c) => cuentasElegidas.includes(c.id))
        .map((c) => c.plataforma),
    );
    const tipoSigueValido =
      estado.tipo != null && plataformas.has(PLATAFORMA_DE_TIPO[estado.tipo]);

    onCambio({
      cuentasElegidas,
      destinos,
      tipo: tipoSigueValido ? estado.tipo : null,
    });
  }

  if (cuentas.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Esta marca todavia no tiene cuentas conectadas. Pedile a un
        administrador que las agregue en Administracion, Cuentas y conexiones.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="titulo">Titulo interno</Label>
        <Input
          id="titulo"
          value={estado.tituloInterno}
          maxLength={200}
          placeholder="Promo de verano - carrusel"
          onChange={(e) => onCambio({ tituloInterno: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Solo se ve dentro del sistema. Sirve para encontrarla despues.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Cuentas de destino</Label>
        {bloqueado && (
          <p className="text-xs text-muted-foreground">
            Las cuentas no se cambian una vez creado el borrador. Si te
            equivocaste, crea una publicacion nueva.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {cuentas.map((cuenta) => {
            const Icono = ICONO_PLATAFORMA[cuenta.plataforma];
            const elegida = estado.cuentasElegidas.includes(cuenta.id);

            return (
              <label
                key={cuenta.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  elegida ? "border-primary bg-accent/50" : "hover:bg-accent/30",
                  bloqueado && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={elegida}
                  disabled={bloqueado}
                  onCheckedChange={() => alternarCuenta(cuenta)}
                />
                <Icono className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {cuenta.nombreVisible}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {cuenta.plataforma.toLowerCase()}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {tiposDisponibles.length > 0 && (
        <div className="space-y-3">
          <Label>Tipo de publicacion</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tiposDisponibles.map((tipo) => (
              <button
                key={tipo}
                type="button"
                disabled={bloqueado}
                onClick={() => onCambio({ tipo })}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  estado.tipo === tipo
                    ? "border-primary bg-accent/50"
                    : "hover:bg-accent/30",
                  bloqueado && "cursor-not-allowed opacity-60",
                )}
              >
                <span className="block text-sm font-medium">
                  {ETIQUETA_TIPO[tipo]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {PLATAFORMA_DE_TIPO[tipo].toLowerCase()}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {LIMITES[tipo].nota}
                </span>
              </button>
            ))}
          </div>
          {plataformasElegidas.size > 1 && estado.tipo && (
            <p className="text-xs text-muted-foreground">
              Elegiste cuentas de varias redes. El tipo define los limites de
              archivos; cada red recibe lo que su API acepta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
