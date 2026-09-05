"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { desdeFormulario } from "@/lib/time/asuncion";
import { ejecutarTransicion } from "@/app/(app)/posts/acciones";
import type { AccionWorkflow, EstadoPost } from "@/lib/workflow/types";

/**
 * Botones del flujo de aprobacion. Se muestran segun el estado y el rol; la
 * decision final igual la toma el servidor, esto solo evita ofrecer acciones
 * que van a ser rechazadas.
 */
export function AccionesPost({
  postId,
  estado,
  esAutor,
  puedeAprobar,
  zona,
  fechaSugerida,
  horaSugerida,
}: {
  postId: string;
  estado: EstadoPost;
  esAutor: boolean;
  puedeAprobar: boolean;
  zona: string;
  fechaSugerida: string;
  horaSugerida: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  async function ejecutar(
    accion: AccionWorkflow,
    extra: { comentario?: string; scheduledAt?: string } = {},
  ) {
    setOcupado(true);
    const resultado = await ejecutarTransicion({ postId, accion, ...extra });
    setOcupado(false);

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo completar la accion.");
      return false;
    }

    toast.success("Listo.");
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {estado === "BORRADOR" && esAutor && (
        <Button disabled={ocupado} onClick={() => void ejecutar("ENVIAR_A_REVISION")}>
          Enviar a revision
        </Button>
      )}

      {estado === "CAMBIOS_SOLICITADOS" && esAutor && (
        <Button disabled={ocupado} onClick={() => void ejecutar("ENVIAR_A_REVISION")}>
          Reenviar a revision
        </Button>
      )}

      {estado === "EN_REVISION" && puedeAprobar && (
        <>
          <DialogoAprobar ocupado={ocupado} onConfirmar={(c) => ejecutar("APROBAR", { comentario: c })} />
          <DialogoCambios ocupado={ocupado} onConfirmar={(c) => ejecutar("SOLICITAR_CAMBIOS", { comentario: c })} />
        </>
      )}

      {estado === "APROBADO" && (
        <>
          <DialogoProgramar
            ocupado={ocupado}
            zona={zona}
            fechaSugerida={fechaSugerida}
            horaSugerida={horaSugerida}
            onConfirmar={(iso) => ejecutar("PROGRAMAR", { scheduledAt: iso })}
          />
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() => void ejecutar("PUBLICAR_AHORA")}
          >
            Publicar ahora
          </Button>
        </>
      )}

      {estado === "PROGRAMADO" && (
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => void ejecutar("CANCELAR_PROGRAMACION")}
        >
          Sacar de la cola
        </Button>
      )}

      {estado === "FALLIDO" && (
        <DialogoProgramar
          ocupado={ocupado}
          zona={zona}
          fechaSugerida={fechaSugerida}
          horaSugerida={horaSugerida}
          etiqueta="Reintentar"
          onConfirmar={(iso) => ejecutar("REINTENTAR", { scheduledAt: iso })}
        />
      )}

      {estado === "PUBLICADO" && puedeAprobar && (
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => void ejecutar("ARCHIVAR")}
        >
          Archivar
        </Button>
      )}

      {puedeAprobar &&
        estado !== "PUBLICADO" &&
        estado !== "CANCELADO" && (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={ocupado}
            onClick={() => void ejecutar("CANCELAR")}
          >
            Cancelar publicacion
          </Button>
        )}
    </div>
  );
}

function DialogoAprobar({
  ocupado,
  onConfirmar,
}: {
  ocupado: boolean;
  onConfirmar: (comentario?: string) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [comentario, setComentario] = useState("");

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button disabled={ocupado} />}>Aprobar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprobar la publicacion</DialogTitle>
          <DialogDescription>
            Podes dejar un comentario, aunque no es obligatorio.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={comentario}
          placeholder="Comentario (opcional)"
          onChange={(e) => setComentario(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (await onConfirmar(comentario.trim() || undefined)) {
                setAbierto(false);
                setComentario("");
              }
            }}
          >
            Aprobar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoCambios({
  ocupado,
  onConfirmar,
}: {
  ocupado: boolean;
  onConfirmar: (comentario: string) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [comentario, setComentario] = useState("");

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" disabled={ocupado} />}>
        Solicitar cambios
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar cambios</DialogTitle>
          <DialogDescription>
            Deci que hay que cambiar. El comentario es obligatorio: sin el, el
            community manager no sabe que corregir.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={comentario}
          placeholder="Cambiar la foto de portada, el texto queda largo..."
          onChange={(e) => setComentario(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!comentario.trim()}
            onClick={async () => {
              if (await onConfirmar(comentario.trim())) {
                setAbierto(false);
                setComentario("");
              }
            }}
          >
            Devolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogoProgramar({
  ocupado,
  zona,
  fechaSugerida,
  horaSugerida,
  etiqueta = "Programar",
  onConfirmar,
}: {
  ocupado: boolean;
  zona: string;
  fechaSugerida: string;
  horaSugerida: string;
  etiqueta?: string;
  onConfirmar: (iso: string) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(fechaSugerida);
  const [hora, setHora] = useState(horaSugerida);

  const utc = fecha && hora ? desdeFormulario(fecha, hora, zona) : null;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button disabled={ocupado} />}>
        {etiqueta}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{etiqueta}</DialogTitle>
          <DialogDescription>
            La hora es de Paraguay. Tiene que ser al menos 10 minutos en el
            futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prog-fecha">Fecha</Label>
            <Input
              id="prog-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prog-hora">Hora</Label>
            <Input
              id="prog-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!utc}
            onClick={async () => {
              if (utc && (await onConfirmar(utc.toISOString()))) {
                setAbierto(false);
              }
            }}
          >
            {etiqueta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
