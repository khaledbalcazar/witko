"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
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
import { Plus, Tags, Trash2 } from "lucide-react";
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
  completarTarjeta,
  crearColumna,
  crearTarjeta,
  eliminarColumna,
  moverTarjeta,
  renombrarColumna,
} from "@/app/(app)/tablero/acciones";
import { DialogoTarjeta } from "./dialogo-tarjeta";
import { GestorEtiquetas } from "./gestor-etiquetas";
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

const SIN_FILTRO_RESPONSABLE = "todos";
const SIN_FILTRO_ETIQUETA = "todas";

/**
 * Tablero de tareas del equipo.
 *
 * Todo cambio se pinta primero y se manda al servidor despues. No se llama a
 * router.refresh(): eso volvia a consultar la pagina entera en cada clic y
 * hacia que crear una tarjeta o marcar un paso se sintiera lento. Si el
 * servidor rechaza el cambio, se revierte al estado anterior y se avisa.
 */
export function Tablero({
  boardId,
  nombre,
  zona,
  columnas: columnasIniciales,
  tarjetas: tarjetasIniciales,
  etiquetas: etiquetasIniciales,
  miembros,
  publicaciones,
  usuarioId,
}: {
  boardId: string;
  nombre: string;
  zona: string;
  columnas: Columna[];
  tarjetas: Tarjeta[];
  etiquetas: Etiqueta[];
  miembros: Array<{ id: string; nombre: string }>;
  publicaciones: Array<{ id: string; titulo: string; estado: string }>;
  usuarioId: string;
}) {
  const [columnas, setColumnas] = useState(columnasIniciales);
  const [tarjetas, setTarjetas] = useState(tarjetasIniciales);
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciales);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [filtroAsignado, setFiltroAsignado] = useState(SIN_FILTRO_RESPONSABLE);
  const [filtroEtiqueta, setFiltroEtiqueta] = useState(SIN_FILTRO_ETIQUETA);
  const [nuevaColumna, setNuevaColumna] = useState("");
  const [gestionandoEtiquetas, setGestionandoEtiquetas] = useState(false);

  const sensores = useSensors(
    // Un umbral de 6 px separa el clic de la tarjeta del arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /**
   * Aplica el cambio en pantalla, manda la accion y revierte si falla.
   * Es el unico camino por el que se modifica el tablero.
   */
  const optimista = useCallback(
    async <T,>(
      anterior: T,
      restaurar: (valor: T) => void,
      accion: () => Promise<{ ok: boolean; mensaje?: string }>,
    ) => {
      try {
        const resultado = await accion();
        if (!resultado.ok) {
          restaurar(anterior);
          toast.error(resultado.mensaje ?? "No se pudo guardar el cambio.");
        }
      } catch {
        restaurar(anterior);
        toast.error("Se perdio la conexion. El cambio no se guardo.");
      }
    },
    [],
  );

  const visibles = useMemo(
    () =>
      tarjetas.filter(
        (t) =>
          (filtroAsignado === SIN_FILTRO_RESPONSABLE ||
            t.asignadoId === filtroAsignado) &&
          (filtroEtiqueta === SIN_FILTRO_ETIQUETA ||
            t.etiquetaIds.includes(filtroEtiqueta)),
      ),
    [tarjetas, filtroAsignado, filtroEtiqueta],
  );

  function porColumna(columnaId: string): Tarjeta[] {
    return visibles
      .filter((t) => t.columnId === columnaId)
      .sort((a, b) => a.orden - b.orden);
  }

  /* ---------------- tarjetas ---------------- */

  function agregarTarjeta(columnId: string, titulo: string) {
    const enColumna = tarjetas.filter((t) => t.columnId === columnId);
    const orden =
      enColumna.reduce((maximo, t) => Math.max(maximo, t.orden), 0) + 1000;

    const nueva: Tarjeta = {
      id: crypto.randomUUID(),
      columnId,
      orden,
      titulo,
      descripcion: null,
      prioridad: "MEDIA",
      dueAt: null,
      completadoAt: null,
      asignadoId: null,
      asignadoNombre: null,
      postId: null,
      postTitulo: null,
      postEstado: null,
      etiquetaIds: [],
      checklist: [],
      comentarios: [],
    };

    const previas = tarjetas;
    setTarjetas([...tarjetas, nueva]);

    void optimista(previas, setTarjetas, () =>
      crearTarjeta({ id: nueva.id, boardId, columnId, titulo, orden }),
    );
  }

  const actualizarTarjeta = useCallback(
    (cardId: string, cambio: Partial<Tarjeta>) => {
      setTarjetas((previas) =>
        previas.map((t) => (t.id === cardId ? { ...t, ...cambio } : t)),
      );
    },
    [],
  );

  const quitarTarjeta = useCallback((cardId: string) => {
    setTarjetas((previas) => previas.filter((t) => t.id !== cardId));
  }, []);

  function completar(cardId: string, hecha: boolean) {
    const previas = tarjetas;
    actualizarTarjeta(cardId, {
      completadoAt: hecha ? new Date().toISOString() : null,
    });
    void optimista(previas, setTarjetas, () => completarTarjeta(cardId, hecha));
  }

  async function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over) return;

    const cardId = String(active.id);
    const tarjeta = tarjetas.find((t) => t.id === cardId);
    if (!tarjeta) return;

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

    const previas = tarjetas;
    actualizarTarjeta(cardId, { columnId: columnaDestino, orden: ordenNuevo });

    void optimista(previas, setTarjetas, () =>
      moverTarjeta({
        cardId,
        columnId: columnaDestino,
        anteriorId: anterior?.id ?? null,
        siguienteId: siguiente?.id ?? null,
      }),
    );
  }

  /* ---------------- columnas ---------------- */

  function agregarColumna(nombreColumna: string) {
    const orden =
      columnas.reduce((maximo, c) => Math.max(maximo, c.orden), 0) + 1000;
    const nueva: Columna = {
      id: crypto.randomUUID(),
      nombre: nombreColumna,
      color: null,
      orden,
    };

    const previas = columnas;
    setColumnas([...columnas, nueva]);
    setNuevaColumna("");

    void optimista(previas, setColumnas, () =>
      crearColumna({ id: nueva.id, boardId, nombre: nombreColumna, color: null }),
    );
  }

  function renombrar(columnaId: string, nombreNuevo: string) {
    const previas = columnas;
    setColumnas((cs) =>
      cs.map((c) => (c.id === columnaId ? { ...c, nombre: nombreNuevo } : c)),
    );
    void optimista(previas, setColumnas, () =>
      renombrarColumna(columnaId, nombreNuevo),
    );
  }

  function borrarColumna(columnaId: string) {
    const previas = columnas;
    setColumnas((cs) => cs.filter((c) => c.id !== columnaId));
    void optimista(previas, setColumnas, () => eliminarColumna(columnaId));
  }

  const tarjetaAbierta = tarjetas.find((t) => t.id === abiertaId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{nombre}</h1>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGestionandoEtiquetas(true)}
          >
            <Tags className="size-4" />
            Etiquetas
          </Button>

          <Select
            value={filtroAsignado}
            onValueChange={(v) => setFiltroAsignado(v ?? SIN_FILTRO_RESPONSABLE)}
            items={{
              [SIN_FILTRO_RESPONSABLE]: "Todos los responsables",
              ...Object.fromEntries(miembros.map((m) => [m.id, m.nombre])),
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_FILTRO_RESPONSABLE}>
                Todos los responsables
              </SelectItem>
              {miembros.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtroEtiqueta}
            onValueChange={(v) => setFiltroEtiqueta(v ?? SIN_FILTRO_ETIQUETA)}
            items={{
              [SIN_FILTRO_ETIQUETA]: "Todas las etiquetas",
              ...Object.fromEntries(etiquetas.map((e) => [e.id, e.nombre])),
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_FILTRO_ETIQUETA}>
                Todas las etiquetas
              </SelectItem>
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
          {[...columnas]
            .sort((a, b) => a.orden - b.orden)
            .map((columna) => (
              <ColumnaTablero
                key={columna.id}
                columna={columna}
                tarjetas={porColumna(columna.id)}
                etiquetas={etiquetas}
                zona={zona}
                onAgregar={(titulo) => agregarTarjeta(columna.id, titulo)}
                onRenombrar={(n) => renombrar(columna.id, n)}
                onBorrar={() => borrarColumna(columna.id)}
                onAbrir={(t) => setAbiertaId(t.id)}
                onCompletar={completar}
              />
            ))}

          <div className="w-64 shrink-0">
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (nuevaColumna.trim()) agregarColumna(nuevaColumna.trim());
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

      {tarjetaAbierta && (
        <DialogoTarjeta
          tarjeta={tarjetaAbierta}
          etiquetas={etiquetas}
          miembros={miembros}
          publicaciones={publicaciones}
          zona={zona}
          usuarioId={usuarioId}
          onCambio={(cambio) => actualizarTarjeta(tarjetaAbierta.id, cambio)}
          onArchivar={() => {
            setAbiertaId(null);
            quitarTarjeta(tarjetaAbierta.id);
          }}
          onCerrar={() => setAbiertaId(null)}
        />
      )}

      {gestionandoEtiquetas && (
        <GestorEtiquetas
          boardId={boardId}
          etiquetas={etiquetas}
          onCambio={setEtiquetas}
          onQuitarDeTarjetas={(etiquetaId) =>
            setTarjetas((previas) =>
              previas.map((t) => ({
                ...t,
                etiquetaIds: t.etiquetaIds.filter((id) => id !== etiquetaId),
              })),
            )
          }
          onCerrar={() => setGestionandoEtiquetas(false)}
        />
      )}
    </div>
  );
}

function ColumnaTablero({
  columna,
  tarjetas,
  etiquetas,
  zona,
  onAgregar,
  onRenombrar,
  onBorrar,
  onAbrir,
  onCompletar,
}: {
  columna: Columna;
  tarjetas: Tarjeta[];
  etiquetas: Etiqueta[];
  zona: string;
  onAgregar: (titulo: string) => void;
  onRenombrar: (nombre: string) => void;
  onBorrar: () => void;
  onAbrir: (tarjeta: Tarjeta) => void;
  onCompletar: (cardId: string, hecha: boolean) => void;
}) {
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
            onBlur={() => {
              setEditandoNombre(false);
              const limpio = nombre.trim();
              if (!limpio || limpio === columna.nombre) {
                setNombre(columna.nombre);
                return;
              }
              onRenombrar(limpio);
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
          onClick={onBorrar}
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
              onCompletar={onCompletar}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2 pt-0">
        {agregando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const limpio = titulo.trim();
              if (!limpio) return;
              onAgregar(limpio);
              // Se limpia sin cerrar: cargar varias tareas seguidas es lo comun.
              setTitulo("");
            }}
            className="space-y-2"
          >
            <Input
              autoFocus
              value={titulo}
              placeholder="Titulo de la tarea"
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTitulo("");
                  setAgregando(false);
                }
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
                onClick={() => {
                  setTitulo("");
                  setAgregando(false);
                }}
              >
                Listo
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
  onCompletar,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  zona: string;
  onAbrir: (tarjeta: Tarjeta) => void;
  onCompletar: (cardId: string, hecha: boolean) => void;
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
        onCompletar={(hecha) => onCompletar(tarjeta.id, hecha)}
      />
    </div>
  );
}
