"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  crearColumna,
  crearTarjeta,
  eliminarColumna,
  moverTarjeta,
  renombrarColumna,
} from "@/app/(app)/tablero/acciones";
import { DialogoTarjeta } from "./dialogo-tarjeta";
import { TarjetaTablero, type Tarjeta } from "./tarjeta";

export interface Columna {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
}

export interface Etiqueta {
  id: string;
  nombre: string;
  color: string;
}

/**
 * Tablero de tareas del equipo.
 *
 * El movimiento se aplica primero en pantalla y despues se manda al servidor:
 * arrastrar tiene que sentirse instantaneo. Si el servidor rechaza el
 * movimiento, `router.refresh()` devuelve la tarjeta a su lugar.
 */
export function Tablero({
  boardId,
  nombre,
  zona,
  columnas,
  tarjetas: tarjetasIniciales,
  etiquetas,
  miembros,
  publicaciones,
}: {
  boardId: string;
  nombre: string;
  zona: string;
  columnas: Columna[];
  tarjetas: Tarjeta[];
  etiquetas: Etiqueta[];
  miembros: Array<{ id: string; nombre: string }>;
  publicaciones: Array<{ id: string; titulo: string; estado: string }>;
}) {
  const router = useRouter();
  const [tarjetas, setTarjetas] = useState(tarjetasIniciales);
  const [abierta, setAbierta] = useState<Tarjeta | null>(null);
  const [filtroAsignado, setFiltroAsignado] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("todas");
  const [nuevaColumna, setNuevaColumna] = useState("");

  const sensores = useSensors(
    // Un umbral de 6 px separa el clic de la tarjeta del arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visibles = useMemo(
    () =>
      tarjetas.filter(
        (t) =>
          (filtroAsignado === "todos" || t.asignadoId === filtroAsignado) &&
          (filtroEtiqueta === "todas" || t.etiquetaIds.includes(filtroEtiqueta)),
      ),
    [tarjetas, filtroAsignado, filtroEtiqueta],
  );

  function porColumna(columnaId: string): Tarjeta[] {
    return visibles
      .filter((t) => t.columnId === columnaId)
      .sort((a, b) => a.orden - b.orden);
  }

  async function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;

    const cardId = String(active.id);
    const tarjeta = tarjetas.find((t) => t.id === cardId);
    if (!tarjeta) return;

    // Se puede soltar sobre otra tarjeta o sobre la columna vacia.
    const sobreTarjeta = tarjetas.find((t) => t.id === over.id);
    const columnaDestino = sobreTarjeta
      ? sobreTarjeta.columnId
      : String(over.id).replace("columna-", "");

    if (!columnas.some((c) => c.id === columnaDestino)) return;

    const enDestino = tarjetas
      .filter((t) => t.columnId === columnaDestino && t.id !== cardId)
      .sort((a, b) => a.orden - b.orden);

    const indice = sobreTarjeta
      ? enDestino.findIndex((t) => t.id === sobreTarjeta.id)
      : enDestino.length;

    const anterior = indice > 0 ? enDestino[indice - 1] : null;
    const siguiente = indice >= 0 ? enDestino[indice] : null;

    const ordenNuevo =
      anterior && siguiente
        ? (anterior.orden + siguiente.orden) / 2
        : anterior
          ? anterior.orden + 1000
          : siguiente
            ? siguiente.orden - 1000
            : 1000;

    setTarjetas((previas) =>
      previas.map((t) =>
        t.id === cardId
          ? { ...t, columnId: columnaDestino, orden: ordenNuevo }
          : t,
      ),
    );

    const resultado = await moverTarjeta({
      cardId,
      columnId: columnaDestino,
      anteriorId: anterior?.id ?? null,
      siguienteId: siguiente?.id ?? null,
    });

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo mover la tarjeta.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{nombre}</h1>

        <div className="ml-auto flex flex-wrap gap-2">
          <Select
            value={filtroAsignado}
            onValueChange={(v) => setFiltroAsignado(v ?? "todos")}
            items={{
              todos: "Todos los responsables",
              ...Object.fromEntries(miembros.map((m) => [m.id, m.nombre])),
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los responsables</SelectItem>
              {miembros.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroEtiqueta}
            onValueChange={(v) => setFiltroEtiqueta(v ?? "todas")}
            items={{
              todas: "Todas las etiquetas",
              ...Object.fromEntries(etiquetas.map((e) => [e.id, e.nombre])),
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las etiquetas</SelectItem>
              {etiquetas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragEnd={(e) => void alSoltar(e)}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {columnas.map((columna) => (
            <ColumnaTablero
              key={columna.id}
              boardId={boardId}
              columna={columna}
              tarjetas={porColumna(columna.id)}
              etiquetas={etiquetas}
              zona={zona}
              onAbrir={setAbierta}
            />
          ))}

          <div className="w-64 shrink-0">
            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!nuevaColumna.trim()) return;
                const resultado = await crearColumna({
                  boardId,
                  nombre: nuevaColumna,
                  color: null,
                });
                if (!resultado.ok) {
                  toast.error(resultado.mensaje ?? "No se pudo crear.");
                  return;
                }
                setNuevaColumna("");
                router.refresh();
              }}
            >
              <Input
                value={nuevaColumna}
                placeholder="Nueva columna"
                onChange={(e) => setNuevaColumna(e.target.value)}
              />
              <Button type="submit" size="icon" variant="outline">
                <Plus className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </DndContext>

      {abierta && (
        <DialogoTarjeta
          tarjeta={abierta}
          etiquetas={etiquetas}
          miembros={miembros}
          publicaciones={publicaciones}
          zona={zona}
          onCerrar={() => setAbierta(null)}
        />
      )}
    </div>
  );
}

function ColumnaTablero({
  boardId,
  columna,
  tarjetas,
  etiquetas,
  zona,
  onAbrir,
}: {
  boardId: string;
  columna: Columna;
  tarjetas: Tarjeta[];
  etiquetas: Etiqueta[];
  zona: string;
  onAbrir: (tarjeta: Tarjeta) => void;
}) {
  const router = useRouter();
  const [agregando, setAgregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(columna.nombre);

  const { setNodeRef, isOver } = useDroppable({ id: "columna-" + columna.id });

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: columna.color ?? "#94a3b8" }}
        />

        {editandoNombre ? (
          <Input
            autoFocus
            value={nombre}
            className="h-7"
            onChange={(e) => setNombre(e.target.value)}
            onBlur={async () => {
              setEditandoNombre(false);
              if (nombre.trim() === columna.nombre) return;
              const r = await renombrarColumna(columna.id, nombre);
              if (!r.ok) {
                toast.error(r.mensaje ?? "No se pudo renombrar.");
                setNombre(columna.nombre);
                return;
              }
              router.refresh();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setNombre(columna.nombre);
                setEditandoNombre(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditandoNombre(true)}
            className="text-sm font-medium"
          >
            {columna.nombre}
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {tarjetas.length}
        </span>

        <button
          type="button"
          aria-label={"Borrar columna " + columna.nombre}
          className="text-muted-foreground hover:text-destructive"
          onClick={async () => {
            const r = await eliminarColumna(columna.id);
            if (!r.ok) {
              toast.error(r.mensaje ?? "No se pudo borrar.");
              return;
            }
            router.refresh();
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div ref={setNodeRef} className="flex min-h-16 flex-col gap-2 px-2 pb-2">
        <SortableContext
          items={tarjetas.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tarjetas.map((tarjeta) => (
            <TarjetaArrastrable
              key={tarjeta.id}
              tarjeta={tarjeta}
              etiquetas={etiquetas}
              zona={zona}
              onAbrir={onAbrir}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2 pt-0">
        {agregando ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!titulo.trim()) return;
              const r = await crearTarjeta({
                boardId,
                columnId: columna.id,
                titulo,
              });
              if (!r.ok) {
                toast.error(r.mensaje ?? "No se pudo crear.");
                return;
              }
              setTitulo("");
              setAgregando(false);
              router.refresh();
            }}
            className="space-y-2"
          >
            <Input
              autoFocus
              value={titulo}
              placeholder="Titulo de la tarea"
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAgregando(false);
              }}
            />
            <div className="flex gap-1">
              <Button type="submit" size="sm">
                Agregar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAgregando(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setAgregando(true)}
          >
            <Plus className="size-4" />
            Agregar tarea
          </Button>
        )}
      </div>
    </div>
  );
}

function TarjetaArrastrable({
  tarjeta,
  etiquetas,
  zona,
  onAbrir,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  zona: string;
  onAbrir: (tarjeta: Tarjeta) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tarjeta.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-50")}
    >
      <TarjetaTablero
        tarjeta={tarjeta}
        etiquetas={etiquetas}
        zona={zona}
        onAbrir={() => onAbrir(tarjeta)}
      />
    </div>
  );
}
