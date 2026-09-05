"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, Plus } from "lucide-react";
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
import { partesFormulario, desdeFormulario } from "@/lib/time/asuncion";
import {
  agregarItemChecklist,
  archivarTarjeta,
  editarTarjeta,
  marcarItemChecklist,
} from "@/app/(app)/tablero/acciones";
import type { Etiqueta } from "./tablero";
import type { Tarjeta } from "./tarjeta";

const SIN_ASIGNAR = "sin-asignar";
const SIN_POST = "sin-post";

/** Detalle de una tarea: responsable, prioridad, fecha, etiquetas y checklist. */
export function DialogoTarjeta({
  tarjeta,
  etiquetas,
  miembros,
  publicaciones,
  zona,
  onCerrar,
}: {
  tarjeta: Tarjeta;
  etiquetas: Etiqueta[];
  miembros: Array<{ id: string; nombre: string }>;
  publicaciones: Array<{ id: string; titulo: string; estado: string }>;
  zona: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(tarjeta.titulo);
  const [descripcion, setDescripcion] = useState(tarjeta.descripcion ?? "");
  const [asignadoId, setAsignadoId] = useState(tarjeta.asignadoId ?? SIN_ASIGNAR);
  const [prioridad, setPrioridad] = useState(tarjeta.prioridad);
  const [postId, setPostId] = useState(tarjeta.postId ?? SIN_POST);
  const [seleccionadas, setSeleccionadas] = useState(tarjeta.etiquetaIds);
  const [nuevoItem, setNuevoItem] = useState("");
  const [guardando, setGuardando] = useState(false);

  const { fecha: fechaInicial } = tarjeta.dueAt
    ? partesFormulario(new Date(tarjeta.dueAt), zona)
    : { fecha: "" };
  const [fecha, setFecha] = useState(fechaInicial);

  async function guardar() {
    setGuardando(true);
    const resultado = await editarTarjeta(tarjeta.id, {
      titulo,
      descripcion: descripcion.trim() || null,
      asignadoId: asignadoId === SIN_ASIGNAR ? null : asignadoId,
      prioridad,
      postId: postId === SIN_POST ? null : postId,
      dueAt: fecha ? desdeFormulario(fecha, "09:00", zona) : null,
      etiquetaIds: seleccionadas,
    });
    setGuardando(false);

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo guardar.");
      return;
    }

    onCerrar();
    router.refresh();
  }

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
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarea-desc">Descripcion</Label>
            <Textarea
              id="tarea-desc"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={asignadoId} onValueChange={(v) => setAsignadoId(v ?? SIN_ASIGNAR)}>
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
                value={prioridad}
                onValueChange={(v) => setPrioridad(v as Tarjeta["prioridad"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BAJA">Baja</SelectItem>
                  <SelectItem value="MEDIA">Media</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="URGENTE">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarea-fecha">Fecha limite</Label>
            <Input
              id="tarea-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Publicacion vinculada</Label>
            <Select value={postId} onValueChange={(v) => setPostId(v ?? SIN_POST)}>
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
            <p className="text-xs text-muted-foreground">
              Vincular la tarea con su publicacion hace que el tablero muestre el
              estado real, sin tener que copiarlo a mano.
            </p>
          </div>

          {etiquetas.length > 0 && (
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map((e) => {
                  const activa = seleccionadas.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() =>
                        setSeleccionadas((previas) =>
                          activa
                            ? previas.filter((id) => id !== e.id)
                            : [...previas, e.id],
                        )
                      }
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
            </div>
          )}

          <div className="space-y-2">
            <Label>Checklist</Label>
            {tarjeta.checklist.length > 0 && (
              <ul className="space-y-1">
                {tarjeta.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={item.hecho}
                      onCheckedChange={async (valor) => {
                        await marcarItemChecklist(item.id, valor === true);
                        router.refresh();
                      }}
                    />
                    <span className={cn(item.hecho && "text-muted-foreground line-through")}>
                      {item.texto}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="flex gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!nuevoItem.trim()) return;
                const r = await agregarItemChecklist(tarjeta.id, nuevoItem);
                if (!r.ok) {
                  toast.error(r.mensaje ?? "No se pudo agregar.");
                  return;
                }
                setNuevoItem("");
                router.refresh();
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
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="ghost"
            className="mr-auto text-muted-foreground"
            onClick={async () => {
              const r = await archivarTarjeta(tarjeta.id);
              if (!r.ok) {
                toast.error(r.mensaje ?? "No se pudo archivar.");
                return;
              }
              onCerrar();
              router.refresh();
            }}
          >
            <Archive className="size-4" />
            Archivar
          </Button>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
