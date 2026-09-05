"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatearLocal, partesFormulario, desdeFormulario } from "@/lib/time/asuncion";
import {
  agregarItemChecklist,
  archivarTarjeta,
  comentarTarjeta,
  editarTarjeta,
  eliminarComentario,
  eliminarItemChecklist,
  marcarItemChecklist,
} from "@/app/(app)/tablero/acciones";
import type { Etiqueta } from "./tablero";
import type { ComentarioTarjeta, ItemChecklist, Tarjeta } from "./tarjeta";

const SIN_ASIGNAR = "sin-asignar";
const SIN_POST = "sin-post";

const ETIQUETA_PRIORIDAD: Record<Tarjeta["prioridad"], string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

/**
 * Detalle de una tarea.
 *
 * Cada cambio se aplica en el acto sobre el estado del tablero y se manda al
 * servidor detras; no hay boton de guardar ni recarga de pagina. Si algo falla,
 * se avisa y el tablero se queda como estaba.
 */
export function DialogoTarjeta({
  tarjeta,
  etiquetas,
  miembros,
  publicaciones,
  zona,
  usuarioId,
  onCambio,
  onArchivar,
  onCerrar,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  miembros: Array<{ id: string; nombre: string }>;
  publicaciones: Array<{ id: string; titulo: string; estado: string }>;
  zona: string;
  usuarioId: string;
  onCambio: (cambio: Partial<Tarjeta>) => void;
  onArchivar: () => void;
  onCerrar: () => void;
}) {
  const [nuevoItem, setNuevoItem] = useState("");
  const [nuevoComentario, setNuevoComentario] = useState("");

  /** Aplica el cambio y lo persiste; si falla, avisa y deja el valor anterior. */
  async function persistir(
    cambio: Partial<Tarjeta>,
    accion: () => Promise<{ ok: boolean; mensaje?: string }>,
  ) {
    const anterior: Partial<Tarjeta> = {};
    for (const clave of Object.keys(cambio) as Array<keyof Tarjeta>) {
      (anterior as Record<string, unknown>)[clave] = tarjeta[clave];
    }

    onCambio(cambio);

    try {
      const resultado = await accion();
      if (!resultado.ok) {
        onCambio(anterior);
        toast.error(resultado.mensaje ?? "No se pudo guardar.");
      }
    } catch {
      onCambio(anterior);
      toast.error("Se perdio la conexion. El cambio no se guardo.");
    }
  }

  const { fecha: fechaActual } = tarjeta.dueAt
    ? partesFormulario(new Date(tarjeta.dueAt), zona)
    : { fecha: "" };

  function alternarEtiqueta(etiquetaId: string) {
    const etiquetaIds = tarjeta.etiquetaIds.includes(etiquetaId)
      ? tarjeta.etiquetaIds.filter((id) => id !== etiquetaId)
      : [...tarjeta.etiquetaIds, etiquetaId];

    void persistir({ etiquetaIds }, () =>
      editarTarjeta(tarjeta.id, { etiquetaIds }),
    );
  }

  function agregarItem(texto: string) {
    const item: ItemChecklist = {
      id: crypto.randomUUID(),
      texto,
      hecho: false,
    };
    void persistir({ checklist: [...tarjeta.checklist, item] }, () =>
      agregarItemChecklist({ id: item.id, cardId: tarjeta.id, texto }),
    );
  }

  function marcarItem(itemId: string, hecho: boolean) {
    void persistir(
      {
        checklist: tarjeta.checklist.map((i) =>
          i.id === itemId ? { ...i, hecho } : i,
        ),
      },
      () => marcarItemChecklist(itemId, hecho),
    );
  }

  function borrarItem(itemId: string) {
    void persistir(
      { checklist: tarjeta.checklist.filter((i) => i.id !== itemId) },
      () => eliminarItemChecklist(itemId),
    );
  }

  function comentar(cuerpo: string) {
    const comentario: ComentarioTarjeta = {
      id: crypto.randomUUID(),
      cuerpo,
      autorId: usuarioId,
      autorNombre: "Vos",
      createdAt: new Date().toISOString(),
    };
    void persistir(
      { comentarios: [...tarjeta.comentarios, comentario] },
      () => comentarTarjeta({ id: comentario.id, cardId: tarjeta.id, cuerpo }),
    );
  }

  function borrarComentario(comentarioId: string) {
    void persistir(
      { comentarios: tarjeta.comentarios.filter((c) => c.id !== comentarioId) },
      () => eliminarComentario(comentarioId),
    );
  }

  const hechos = tarjeta.checklist.filter((i) => i.hecho).length;

  return (
    <Dialog open onOpenChange={onCerrar}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tarea</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tarea-titulo">Titulo</Label>
            <Input
              id="tarea-titulo"
              defaultValue={tarjeta.titulo}
              onBlur={(e) => {
                const titulo = e.target.value.trim();
                if (!titulo || titulo === tarjeta.titulo) return;
                void persistir({ titulo }, () =>
                  editarTarjeta(tarjeta.id, { titulo }),
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarea-desc">Descripcion</Label>
            <Textarea
              id="tarea-desc"
              rows={3}
              defaultValue={tarjeta.descripcion ?? ""}
              onBlur={(e) => {
                const descripcion = e.target.value.trim() || null;
                if (descripcion === tarjeta.descripcion) return;
                void persistir({ descripcion }, () =>
                  editarTarjeta(tarjeta.id, { descripcion }),
                );
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select
                value={tarjeta.asignadoId ?? SIN_ASIGNAR}
                items={{
                  [SIN_ASIGNAR]: "Sin asignar",
                  ...Object.fromEntries(miembros.map((m) => [m.id, m.nombre])),
                }}
                onValueChange={(v) => {
                  const asignadoId = !v || v === SIN_ASIGNAR ? null : v;
                  void persistir(
                    {
                      asignadoId,
                      asignadoNombre:
                        miembros.find((m) => m.id === asignadoId)?.nombre ?? null,
                    },
                    () => editarTarjeta(tarjeta.id, { asignadoId }),
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {miembros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={tarjeta.prioridad}
                items={ETIQUETA_PRIORIDAD}
                onValueChange={(v) => {
                  if (!v) return;
                  const prioridad = v as Tarjeta["prioridad"];
                  void persistir({ prioridad }, () =>
                    editarTarjeta(tarjeta.id, { prioridad }),
                  );
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ETIQUETA_PRIORIDAD).map(([valor, texto]) => (
                    <SelectItem key={valor} value={valor}>
                      {texto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarea-fecha">Fecha limite</Label>
            <Input
              id="tarea-fecha"
              type="date"
              defaultValue={fechaActual}
              onChange={(e) => {
                const valor = e.target.value;
                const dueAt = valor
                  ? desdeFormulario(valor, "09:00", zona).toISOString()
                  : null;
                void persistir({ dueAt }, () =>
                  editarTarjeta(tarjeta.id, {
                    dueAt: dueAt ? new Date(dueAt) : null,
                  }),
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Publicacion vinculada</Label>
            <Select
              value={tarjeta.postId ?? SIN_POST}
              items={{
                [SIN_POST]: "Ninguna",
                ...Object.fromEntries(publicaciones.map((p) => [p.id, p.titulo])),
              }}
              onValueChange={(v) => {
                const postId = !v || v === SIN_POST ? null : v;
                const publicacion = publicaciones.find((p) => p.id === postId);
                void persistir(
                  {
                    postId,
                    postTitulo: publicacion?.titulo ?? null,
                    postEstado: publicacion?.estado ?? null,
                  },
                  () => editarTarjeta(tarjeta.id, { postId }),
                );
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_POST}>Ninguna</SelectItem>
                {publicaciones.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tarjeta.postId && (
              <Link
                href={"/posts/" + tarjeta.postId}
                className="text-xs text-muted-foreground hover:underline"
              >
                Abrir la publicacion
              </Link>
            )}
          </div>

          {etiquetas.length > 0 && (
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map((e) => {
                  const activa = tarjeta.etiquetaIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => alternarEtiqueta(e.id)}
                      className={cn(
                        "rounded px-2 py-1 text-xs font-medium transition-opacity",
                        activa ? "text-white" : "opacity-40",
                      )}
                      style={{ backgroundColor: e.color }}
                    >
                      {e.nombre}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Para crear o borrar etiquetas, usa el boton Etiquetas del tablero.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Checklist
              {tarjeta.checklist.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {hechos} de {tarjeta.checklist.length}
                </span>
              )}
            </Label>

            {tarjeta.checklist.length > 0 && (
              <ul className="space-y-1">
                {tarjeta.checklist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.hecho}
                      onCheckedChange={(valor) =>
                        marcarItem(item.id, valor === true)
                      }
                    />
                    <span
                      className={cn(
                        "flex-1",
                        item.hecho && "text-muted-foreground line-through",
                      )}
                    >
                      {item.texto}
                    </span>
                    <button
                      type="button"
                      aria-label={"Borrar " + item.texto}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => borrarItem(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                const texto = nuevoItem.trim();
                if (!texto) return;
                agregarItem(texto);
                setNuevoItem("");
              }}
            >
              <Input
                value={nuevoItem}
                placeholder="Agregar un paso"
                onChange={(e) => setNuevoItem(e.target.value)}
              />
              <Button type="submit" size="icon" variant="outline">
                <Plus className="size-4" />
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            <Label>
              Comentarios
              {tarjeta.comentarios.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {tarjeta.comentarios.length}
                </span>
              )}
            </Label>

            {tarjeta.comentarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavia no hay comentarios.
              </p>
            ) : (
              <ul className="space-y-2">
                {tarjeta.comentarios.map((c) => (
                  <li key={c.id} className="group rounded-md bg-muted p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{c.autorNombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatearLocal(new Date(c.createdAt), "d/MM HH:mm", zona)}
                      </span>
                      {(c.autorId === usuarioId || c.autorNombre === "Vos") && (
                        <button
                          type="button"
                          aria-label="Borrar comentario"
                          className="ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          onClick={() => borrarComentario(c.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{c.cuerpo}</p>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const cuerpo = nuevoComentario.trim();
                if (!cuerpo) return;
                comentar(cuerpo);
                setNuevoComentario("");
              }}
            >
              <Textarea
                rows={2}
                value={nuevoComentario}
                placeholder="Escribi un comentario para el equipo..."
                onChange={(e) => setNuevoComentario(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!nuevoComentario.trim()}
              >
                Comentar
              </Button>
            </form>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="ghost"
            className="mr-auto text-muted-foreground"
            onClick={async () => {
              onArchivar();
              const r = await archivarTarjeta(tarjeta.id);
              if (!r.ok) toast.error(r.mensaje ?? "No se pudo archivar.");
            }}
          >
            <Archive className="size-4" />
            Archivar
          </Button>
          <Button onClick={onCerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
