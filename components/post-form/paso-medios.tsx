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
  PROPORCIONES,
  cumpleProporcion,
  validarArchivo,
  validarConjunto,
} from "@/lib/validation/media-limits";
import { eliminarMedia } from "@/app/(app)/posts/acciones";
import type { ProporcionPost } from "@/lib/validation/tipos";
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
        estado.proporcion,
      )
    : [];

  // Al cambiar la proporcion, los archivos que ya estaban pueden dejar de
  // servir. Se avisa en vez de borrarlos solos: el que decide es el usuario.
  const desalineados = estado.proporcion
    ? estado.medios.filter(
        (m) =>
          m.ancho != null &&
          m.alto != null &&
          estado.proporcion != null &&
          !cumpleProporcion(m.ancho, m.alto, estado.proporcion),
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
        null,
        estado.proporcion,
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
      {limite && limite.proporciones.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Proporcion</p>
          <div className="flex gap-2">
            {limite.proporciones.map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => onCambio({ proporcion: opcion })}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  estado.proporcion === opcion
                    ? "border-primary bg-accent/50"
                    : "hover:bg-accent/30",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "block rounded-[3px] border-2 border-current",
                    opcion === "CUADRADA" ? "size-5" : "h-5 w-4",
                  )}
                />
                <span>{PROPORCIONES[opcion].etiqueta}</span>
                <span className="text-muted-foreground">
                  {PROPORCIONES[opcion].nombre}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Instagram publica el carrusel entero con una sola proporcion, asi
            que todos los archivos tienen que tenerla.
          </p>
        </div>
      )}

      {desalineados.length > 0 && estado.proporcion && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">
            {desalineados.length === 1
              ? "Hay 1 archivo que no es "
              : "Hay " + desalineados.length + " archivos que no son "}
            {PROPORCIONES[estado.proporcion].etiqueta}
            {": borralos o cambia la proporcion, porque si no Instagram los " +
              "recorta por su cuenta."}
          </AlertDescription>
        </Alert>
      )}

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
                    proporcion={estado.proporcion}
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
  proporcion,
  onBorrar,
}: {
  medio: MedioCargado;
  indice: number;
  proporcion: ProporcionPost | null;
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
      <div className={proporcion === "VERTICAL" ? "aspect-[4/5]" : "aspect-square"}>
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
