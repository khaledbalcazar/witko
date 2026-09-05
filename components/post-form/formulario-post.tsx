"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { desdeFormulario } from "@/lib/time/asuncion";
import {
  crearBorrador,
  ejecutarTransicion,
  guardarPost,
} from "@/app/(app)/posts/acciones";
import type { EstadoPost } from "@/lib/workflow/types";
import {
  destinoVacio,
  propagarCaption,
  type CuentaDisponible,
  type EstadoFormulario,
} from "./estado";
import { PasoDestinos } from "./paso-destinos";
import { PasoMedios } from "./paso-medios";
import { PasoContenido } from "./paso-contenido";
import { PasoProgramacion } from "./paso-programacion";
import { PasoVistaPrevia } from "./paso-vista-previa";

const PASOS = [
  "Destinos",
  "Medios",
  "Contenido",
  "Programacion",
  "Vista previa",
];

const INTERVALO_AUTOGUARDADO_MS = 20_000;

export function FormularioPost({
  cuentas,
  inicial,
  estadoPost,
  zona,
}: {
  cuentas: CuentaDisponible[];
  inicial: EstadoFormulario;
  estadoPost: EstadoPost | null;
  zona: string;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState(inicial.postId ? 1 : 0);
  const [estado, setEstado] = useState<EstadoFormulario>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null);
  const [avisoEdicion, setAvisoEdicion] = useState(false);

  // Se compara contra lo ultimo guardado para no mandar el mismo estado dos
  // veces desde el autoguardado.
  const serializado = useMemo(() => JSON.stringify(estado), [estado]);
  const ultimoEnviado = useRef(serializado);

  /**
   * Editar un post que ya salio de borrador lo devuelve a BORRADOR. Se avisa
   * antes de tocar nada, no despues: si el usuario solo entro a mirar, no
   * tiene por que perder la aprobacion.
   */
  const requiereAviso =
    estadoPost != null &&
    estadoPost !== "BORRADOR" &&
    estadoPost !== "CAMBIOS_SOLICITADOS";

  const [avisoAceptado, setAvisoAceptado] = useState(!requiereAviso);

  const actualizar = useCallback(
    (cambio: Partial<EstadoFormulario>) => {
      if (requiereAviso && !avisoAceptado) {
        setAvisoEdicion(true);
        return;
      }
      setEstado((previo) => ({ ...previo, ...cambio }));
    },
    [requiereAviso, avisoAceptado],
  );

  const guardar = useCallback(
    async (silencioso = false): Promise<boolean> => {
      if (!estado.postId || !estado.tipo) return false;

      setGuardando(true);
      const resultado = await guardarPost(estado.postId, {
        tituloInterno: estado.tituloInterno,
        tipo: estado.tipo,
        mediaIds: estado.medios.map((m) => m.id),
        destinos: estado.destinos,
        scheduledAt: fechaProgramada(estado, zona),
      });
      setGuardando(false);

      if (!resultado.ok) {
        toast.error(resultado.mensaje ?? "No se pudo guardar.");
        return false;
      }

      ultimoEnviado.current = JSON.stringify(estado);
      setUltimoGuardado(new Date());

      if (resultado.volvioABorrador) {
        toast.info(
          "La publicacion volvio a borrador porque cambio despues de aprobarse.",
        );
        router.refresh();
      } else if (!silencioso) {
        toast.success("Guardado.");
      }

      return true;
    },
    [estado, router, zona],
  );

  // Autoguardado cada 20 segundos, solo si algo cambio.
  useEffect(() => {
    if (!estado.postId) return;

    const temporizador = setInterval(() => {
      if (JSON.stringify(estado) === ultimoEnviado.current) return;
      void guardar(true);
    }, INTERVALO_AUTOGUARDADO_MS);

    return () => clearInterval(temporizador);
  }, [estado, guardar]);

  async function crearYSeguir() {
    if (!estado.tipo || estado.cuentasElegidas.length === 0) return;

    setGuardando(true);
    const resultado = await crearBorrador({
      tituloInterno: estado.tituloInterno.trim() || "Publicacion sin titulo",
      tipo: estado.tipo,
      socialAccountIds: estado.cuentasElegidas,
    });
    setGuardando(false);

    if (!resultado.ok || !resultado.postId) {
      toast.error(resultado.mensaje ?? "No se pudo crear el borrador.");
      return;
    }

    setEstado((previo) => ({ ...previo, postId: resultado.postId! }));
    setPaso(1);
    // Cambia la URL sin recargar: a partir de aca el borrador ya existe y se
    // puede volver a el si el navegador se cierra.
    window.history.replaceState(null, "", "/posts/" + resultado.postId + "/editar");
  }

  async function enviarARevision() {
    if (!(await guardar(true))) return;

    const resultado = await ejecutarTransicion({
      postId: estado.postId!,
      accion: "ENVIAR_A_REVISION",
    });

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo enviar a revision.");
      return;
    }

    toast.success("Enviada a revision.");
    router.push("/posts/" + estado.postId);
  }

  const puedeAvanzar = validarPaso(paso, estado);

  return (
    <div className="space-y-6">
      <Pasos actual={paso} onIr={setPaso} habilitado={estado.postId != null} />

      <div className="min-h-[24rem]">
        {paso === 0 && (
          <PasoDestinos
            cuentas={cuentas}
            estado={estado}
            onCambio={actualizar}
            bloqueado={estado.postId != null}
          />
        )}
        {paso === 1 && (
          <PasoMedios estado={estado} onCambio={actualizar} />
        )}
        {paso === 2 && (
          <PasoContenido
            cuentas={cuentas}
            estado={estado}
            onCambio={actualizar}
            onCaptionBase={(texto) =>
              actualizar({
                captionBase: texto,
                destinos: estado.captionUnificado
                  ? propagarCaption(estado.destinos, texto)
                  : estado.destinos,
              })
            }
          />
        )}
        {paso === 3 && (
          <PasoProgramacion estado={estado} onCambio={actualizar} zona={zona} />
        )}
        {paso === 4 && (
          <PasoVistaPrevia cuentas={cuentas} estado={estado} zona={zona} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Button
          variant="outline"
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          disabled={paso === 0}
        >
          Atras
        </Button>

        {paso === 0 && !estado.postId ? (
          <Button onClick={crearYSeguir} disabled={!puedeAvanzar || guardando}>
            Crear borrador y seguir
          </Button>
        ) : paso < PASOS.length - 1 ? (
          <Button
            onClick={() => setPaso((p) => p + 1)}
            disabled={!puedeAvanzar}
          >
            Siguiente
          </Button>
        ) : null}

        {estado.postId && (
          <>
            <Button
              variant="outline"
              onClick={() => void guardar()}
              disabled={guardando}
            >
              Guardar borrador
            </Button>

            {paso === PASOS.length - 1 && (
              <Button onClick={() => void enviarARevision()} disabled={guardando}>
                Enviar a revision
              </Button>
            )}
          </>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {guardando
            ? "Guardando..."
            : ultimoGuardado
              ? "Guardado a las " +
                ultimoGuardado.toLocaleTimeString("es-PY", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : estado.postId
                ? "Se guarda solo cada 20 segundos"
                : ""}
        </span>
      </div>

      <Dialog open={avisoEdicion} onOpenChange={setAvisoEdicion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Esta publicacion ya fue revisada</DialogTitle>
            <DialogDescription>
              Si la editas vuelve a borrador y hay que enviarla de nuevo a
              revision. La aprobacion anterior deja de valer, para que no se
              publique algo distinto de lo que se aprobo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoEdicion(false)}>
              Mejor no
            </Button>
            <Button
              onClick={() => {
                setAvisoAceptado(true);
                setAvisoEdicion(false);
              }}
            >
              Entiendo, quiero editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pasos({
  actual,
  onIr,
  habilitado,
}: {
  actual: number;
  onIr: (paso: number) => void;
  habilitado: boolean;
}) {
  return (
    <ol className="flex flex-wrap gap-1 text-sm">
      {PASOS.map((nombre, indice) => (
        <li key={nombre}>
          <button
            type="button"
            onClick={() => (habilitado || indice === 0) && onIr(indice)}
            disabled={!habilitado && indice > 0}
            className={cn(
              "rounded-md px-3 py-1.5 transition-colors",
              indice === actual
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent",
            )}
          >
            <span className="mr-1.5 text-xs opacity-70">{indice + 1}</span>
            {nombre}
          </button>
        </li>
      ))}
    </ol>
  );
}

function validarPaso(paso: number, estado: EstadoFormulario): boolean {
  switch (paso) {
    case 0:
      return estado.cuentasElegidas.length > 0 && estado.tipo != null;
    case 1:
      return estado.medios.length > 0;
    case 2:
      return estado.destinos.every((d) => d.caption.trim().length > 0);
    default:
      return true;
  }
}

function fechaProgramada(estado: EstadoFormulario, zona: string): Date | null {
  if (estado.modoPublicacion !== "PROGRAMAR") return null;
  if (!estado.fecha || !estado.hora) return null;
  return desdeFormulario(estado.fecha, estado.hora, zona);
}

export { destinoVacio };
