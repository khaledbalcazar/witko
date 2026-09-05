"use client";

import { useRef, useState } from "react";
import { GripVertical, Trash2, Upload } from "lucide-react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  LIMITES,
  validarArchivo,
  validarConjunto,
} from "@/lib/validation/media-limits";
import { eliminarMedia } from "@/app/(app)/posts/acciones";
import type { EstadoFormulario, MedioCargado } from "./estado";

/**
 * Paso 2. Sube a Supabase Storage y ordena el carrusel arrastrando.
 *
 * La validacion corre en el navegador antes de subir: no tiene sentido gastar
 * la subida de un video de 200 MB para que el servidor lo rechace despues.
 */
export function PasoMedios({
  estado,
  onCambio,
}: {
  estado: EstadoFormulario;
  onCambio: (cambio: Partial<EstadoFormulario>) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [progreso, setProgreso] = useState<Record<string, number>>({});
  const [rechazados, setRechazados] = useState<string[]>([]);

  const limite = estado.tipo ? LIMITES[estado.tipo] : null;

  const problemasConjunto = estado.tipo
    ? validarConjunto(
        estado.medios.map((m) => ({
          nombre: "archivo",
          mime: m.mime,
          bytes: m.bytes,
          ancho: m.ancho,
          alto: m.alto,
          duracionSeg: m.duracionMs != null ? m.duracionMs / 1000 : null,
        })),
        estado.tipo,
      )
    : [];

  async function procesar(archivos: FileList | null) {
    if (!archivos || !estado.tipo || !estado.postId || !limite) return;

    const nuevos = [...archivos];
    const problemas: string[] = [];

    if (estado.medios.length + nuevos.length > limite.maxArchivos) {
      problemas.push(
        "Solo se pueden subir " +
          limite.maxArchivos +
          " archivos en total y ya hay " +
          estado.medios.length +
          ".",
      );
      setRechazados(problemas);
      return;
    }

    for (const archivo of nuevos) {
      const dimensiones = await medir(archivo);

      const problema = validarArchivo(
        {
          nombre: archivo.name,
          mime: archivo.type,
          bytes: archivo.size,
          ancho: dimensiones.ancho,
          alto: dimensiones.alto,
          duracionSeg:
            dimensiones.duracionMs != null ? dimensiones.duracionMs / 1000 : null,
        },
        estado.tipo,
      );

      if (problema) {
        problemas.push(problema.archivo + ": " + problema.mensaje);
        continue;
      }

      const clave = archivo.name + archivo.size;
      setProgreso((p) => ({ ...p, [clave]: 10 }));

      const cuerpo = new FormData();
      cuerpo.set("archivo", archivo);
      cuerpo.set("postId", estado.postId);
      if (dimensiones.ancho) cuerpo.set("ancho", String(dimensiones.ancho));
      if (dimensiones.alto) cuerpo.set("alto", String(dimensiones.alto));
      if (dimensiones.duracionMs != null) {
        cuerpo.set("duracionMs", String(Math.round(dimensiones.duracionMs)));
      }

      try {
        setProgreso((p) => ({ ...p, [clave]: 50 }));
        const respuesta = await fetch("/api/media/upload", {
          method: "POST",
          body: cuerpo,
        });
        const datos = await respuesta.json();

        if (!datos.ok) {
          problemas.push(archivo.name + ": " + datos.mensaje);
        } else {
          const medio: MedioCargado = {
            id: datos.media.id,
            tipo: datos.media.tipo,
            urlPublica: datos.media.urlPublica,
            mime: datos.media.mime,
            bytes: datos.media.bytes,
            ancho: datos.media.ancho,
            alto: datos.media.alto,
            duracionMs: datos.media.duracionMs,
          };
          onCambio({ medios: [...estado.medios, medio] });
        }
      } catch {
        problemas.push(archivo.name + ": no se pudo subir, revisa la conexion.");
      } finally {
        setProgreso((p) => {
          const copia = { ...p };
          delete copia[clave];
          return copia;
        });
      }
    }

    setRechazados(problemas);
  }

  function alSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const desde = estado.medios.findIndex((m) => m.id === active.id);
    const hasta = estado.medios.findIndex((m) => m.id === over.id);
    onCambio({ medios: arrayMove(estado.medios, desde, hasta) });
  }

  async function borrar(mediaId: string) {
    if (!estado.postId) return;
    const resultado = await eliminarMedia(estado.postId, mediaId);
    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo borrar.");
      return;
    }
    onCambio({ medios: estado.medios.filter((m) => m.id !== mediaId) });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void procesar(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          arrastrando ? "border-primary bg-accent/40" : "border-muted",
        )}
      >
        <Upload className="size-6 text-muted-foreground" />
        <p className="text-sm">Arrastra los archivos aca</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => entrada.current?.click()}
        >
          o elegilos del disco
        </Button>
        <input
          ref={entrada}
          type="file"
          multiple
          hidden
          accept={
            limite
              ? [...limite.mimesImagen, ...limite.mimesVideo].join(",")
              : undefined
          }
          onChange={(e) => void procesar(e.target.files)}
        />
        {limite && (
          <p className="text-xs text-muted-foreground">{limite.nota}</p>
        )}
      </div>

      {Object.entries(progreso).map(([clave, valor]) => (
        <div key={clave} className="space-y-1">
          <p className="text-xs text-muted-foreground">Subiendo...</p>
          <Progress value={valor} />
        </div>
      ))}

      {rechazados.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {rechazados.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {problemasConjunto.length > 0 && (
        <Alert>
          <AlertDescription className="text-sm">
            {problemasConjunto.map((p) => p.mensaje).join(" ")}
          </AlertDescription>
        </Alert>
      )}

      {estado.medios.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Arrastra para cambiar el orden. El primero es la portada.
          </p>
          <DndContext collisionDetection={closestCenter} onDragEnd={alSoltar}>
            <SortableContext
              items={estado.medios.map((m) => m.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {estado.medios.map((medio, indice) => (
                  <Miniatura
                    key={medio.id}
                    medio={medio}
                    indice={indice}
                    onBorrar={() => void borrar(medio.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

function Miniatura({
  medio,
  indice,
  onBorrar,
}: {
  medio: MedioCargado;
  indice: number;
  onBorrar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: medio.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted",
        isDragging && "z-10 opacity-70",
      )}
    >
      <div className="aspect-square">
        {medio.tipo === "VIDEO" ? (
          <video src={medio.urlPublica} className="size-full object-cover" muted />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={medio.urlPublica} alt="" className="size-full object-cover" />
        )}
      </div>

      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
        {indice + 1}
      </span>

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Mover"
        className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white"
      >
        <GripVertical className="size-3" />
      </button>

      <button
        type="button"
        onClick={onBorrar}
        aria-label="Quitar archivo"
        className="absolute bottom-1 right-1 rounded bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

/** Lee dimensiones y duracion en el navegador, antes de subir nada. */
function medir(
  archivo: File,
): Promise<{ ancho: number | null; alto: number | null; duracionMs: number | null }> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(archivo);

    if (archivo.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolver({
          ancho: video.videoWidth || null,
          alto: video.videoHeight || null,
          duracionMs: Number.isFinite(video.duration)
            ? video.duration * 1000
            : null,
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolver({ ancho: null, alto: null, duracionMs: null });
      };
      video.src = url;
      return;
    }

    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver({
        ancho: imagen.naturalWidth,
        alto: imagen.naturalHeight,
        duracionMs: null,
      });
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      resolver({ ancho: null, alto: null, duracionMs: null });
    };
    imagen.src = url;
  });
}
