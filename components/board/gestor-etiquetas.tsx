"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  crearEtiqueta,
  editarEtiqueta,
  eliminarEtiqueta,
} from "@/app/(app)/tablero/acciones";
import type { Etiqueta } from "./tablero";

/** Paleta de arranque. Igual se puede escribir cualquier color a mano. */
const COLORES = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

/**
 * Alta, edicion y baja de etiquetas del tablero.
 *
 * Igual que el resto del tablero, los cambios se ven en el acto y se guardan
 * detras.
 */
export function GestorEtiquetas({
  boardId,
  etiquetas,
  onCambio,
  onQuitarDeTarjetas,
  onCerrar,
}: {
  boardId: string;
  etiquetas: Etiqueta[];
  onCambio: (etiquetas: Etiqueta[]) => void;
  onQuitarDeTarjetas: (etiquetaId: string) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES[0]);

  async function persistir(
    siguientes: Etiqueta[],
    accion: () => Promise<{ ok: boolean; mensaje?: string }>,
  ) {
    const previas = etiquetas;
    onCambio(siguientes);

    try {
      const resultado = await accion();
      if (!resultado.ok) {
        onCambio(previas);
        toast.error(resultado.mensaje ?? "No se pudo guardar.");
      }
    } catch {
      onCambio(previas);
      toast.error("Se perdio la conexion. El cambio no se guardo.");
    }
  }

  function agregar() {
    const limpio = nombre.trim();
    if (!limpio) return;

    if (etiquetas.some((e) => e.nombre.toLowerCase() === limpio.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre.");
      return;
    }

    const nueva: Etiqueta = { id: crypto.randomUUID(), nombre: limpio, color };
    setNombre("");

    void persistir([...etiquetas, nueva], () =>
      crearEtiqueta({ id: nueva.id, boardId, nombre: limpio, color }),
    );
  }

  function renombrar(id: string, nombreNuevo: string, colorNuevo: string) {
    void persistir(
      etiquetas.map((e) =>
        e.id === id ? { ...e, nombre: nombreNuevo, color: colorNuevo } : e,
      ),
      () => editarEtiqueta(id, nombreNuevo, colorNuevo),
    );
  }

  function borrar(id: string) {
    onQuitarDeTarjetas(id);
    void persistir(
      etiquetas.filter((e) => e.id !== id),
      () => eliminarEtiqueta(id),
    );
  }

  return (
    <Dialog open onOpenChange={onCerrar}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Etiquetas del tablero</DialogTitle>
          <DialogDescription>
            Las comparte todo el equipo de esta marca. Borrar una la quita de
            todas las tarjetas que la tengan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {etiquetas.length > 0 && (
            <ul className="space-y-2">
              {etiquetas.map((etiqueta) => (
                <FilaEtiqueta
                  key={etiqueta.id}
                  etiqueta={etiqueta}
                  onGuardar={(n, c) => renombrar(etiqueta.id, n, c)}
                  onBorrar={() => borrar(etiqueta.id)}
                />
              ))}
            </ul>
          )}

          <form
            className="space-y-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              agregar();
            }}
          >
            <Label htmlFor="etiqueta-nueva">Nueva etiqueta</Label>
            <div className="flex gap-1">
              <Input
                id="etiqueta-nueva"
                value={nombre}
                maxLength={40}
                placeholder="Nombre"
                onChange={(e) => setNombre(e.target.value)}
              />
              <Button type="submit" size="icon" variant="outline">
                <Plus className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={"Color " + c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-6 rounded-full border-2 transition-transform",
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </form>
        </div>

        <DialogFooter>
          <Button onClick={onCerrar}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilaEtiqueta({
  etiqueta,
  onGuardar,
  onBorrar,
}: {
  etiqueta: Etiqueta;
  onGuardar: (nombre: string, color: string) => void;
  onBorrar: () => void;
}) {
  const [nombre, setNombre] = useState(etiqueta.nombre);

  return (
    <li className="flex items-center gap-2">
      <span
        className="size-5 shrink-0 rounded"
        style={{ backgroundColor: etiqueta.color }}
      />
      <Input
        value={nombre}
        maxLength={40}
        className="h-8"
        onChange={(e) => setNombre(e.target.value)}
        onBlur={() => {
          const limpio = nombre.trim();
          if (!limpio || limpio === etiqueta.nombre) {
            setNombre(etiqueta.nombre);
            return;
          }
          onGuardar(limpio, etiqueta.color);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <div className="flex gap-1">
        {COLORES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={"Cambiar a " + c}
            onClick={() => onGuardar(etiqueta.nombre, c)}
            className={cn(
              "size-4 rounded-full border",
              etiqueta.color === c ? "border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={"Borrar etiqueta " + etiqueta.nombre}
        className="text-muted-foreground hover:text-destructive"
        onClick={onBorrar}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}
