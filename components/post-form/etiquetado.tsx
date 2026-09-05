"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EtiquetaEnFormulario, MedioCargado } from "./estado";

/**
 * Etiquetas de usuario sobre la imagen.
 *
 * En Instagram las etiquetas de imagenes y historias llevan coordenadas x/y
 * relativas (0 a 1). En reels no: ahi la etiqueta va sin posicion. El
 * componente se adapta segun `conCoordenadas`.
 */
export function EtiquetadoSobreImagen({
  medios,
  etiquetas,
  conCoordenadas,
  onCambio,
}: {
  medios: MedioCargado[];
  etiquetas: EtiquetaEnFormulario[];
  conCoordenadas: boolean;
  onCambio: (etiquetas: EtiquetaEnFormulario[]) => void;
}) {
  const [indiceMedio, setIndiceMedio] = useState(0);
  const [usuario, setUsuario] = useState("");
  const contenedor = useRef<HTMLDivElement>(null);

  const medio = medios[Math.min(indiceMedio, medios.length - 1)];
  if (!medio) return null;

  const delMedio = etiquetas.filter((e) => e.mediaAssetId === medio.id);

  function agregar(x: number | null, y: number | null) {
    const limpio = usuario.trim().replace(/^@/, "");
    if (!limpio) return;

    onCambio([
      ...etiquetas,
      { mediaAssetId: medio.id, username: limpio, x, y },
    ]);
    setUsuario("");
  }

  function alHacerClick(evento: React.MouseEvent<HTMLDivElement>) {
    if (!conCoordenadas || !usuario.trim() || !contenedor.current) return;

    const caja = contenedor.current.getBoundingClientRect();
    const x = (evento.clientX - caja.left) / caja.width;
    const y = (evento.clientY - caja.top) / caja.height;

    agregar(
      Math.min(1, Math.max(0, Number(x.toFixed(4)))),
      Math.min(1, Math.max(0, Number(y.toFixed(4)))),
    );
  }

  function quitar(indice: number) {
    const objetivo = delMedio[indice];
    onCambio(etiquetas.filter((e) => e !== objetivo));
  }

  return (
    <div className="space-y-3">
      <Label>Etiquetar cuentas</Label>

      {medios.length > 1 && (
        <div className="flex gap-2">
          {medios.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setIndiceMedio(i)}
              className={
                "size-12 overflow-hidden rounded border-2 " +
                (i === indiceMedio ? "border-primary" : "border-transparent")
              }
            >
              {m.tipo === "VIDEO" ? (
                <video src={m.urlPublica} className="size-full object-cover" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.urlPublica} alt="" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={usuario}
          placeholder="usuario"
          onChange={(e) => setUsuario(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!conCoordenadas) agregar(null, null);
            }
          }}
        />
        {!conCoordenadas && (
          <Button type="button" variant="outline" onClick={() => agregar(null, null)}>
            <Plus className="size-4" />
            Agregar
          </Button>
        )}
      </div>

      {conCoordenadas ? (
        <>
          <p className="text-xs text-muted-foreground">
            Escribi el usuario y despues hace clic sobre la foto donde quieras
            que aparezca la etiqueta.
          </p>
          <div
            ref={contenedor}
            onClick={alHacerClick}
            className="relative aspect-square max-w-sm cursor-crosshair overflow-hidden rounded-lg border bg-black"
          >
            {medio.tipo === "VIDEO" ? (
              <video src={medio.urlPublica} className="size-full object-cover" muted />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={medio.urlPublica} alt="" className="size-full object-cover" />
            )}

            {delMedio.map((e, i) =>
              e.x != null && e.y != null ? (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white"
                  style={{ left: e.x * 100 + "%", top: e.y * 100 + "%" }}
                >
                  @{e.username}
                </span>
              ) : null,
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          En los reels las etiquetas no llevan posicion sobre el video: se
          agregan como menciones.
        </p>
      )}

      {delMedio.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {delMedio.map((e, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
            >
              @{e.username}
              <button
                type="button"
                aria-label={"Quitar " + e.username}
                onClick={() => quitar(i)}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
