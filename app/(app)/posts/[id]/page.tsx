import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { EstadoPostBadge } from "@/components/estado/estado-post";
import { VistaPrevia } from "@/components/previews/vista-previa";
import { AccionesPost } from "@/components/approvals/acciones-post";
import { HiloComentarios } from "@/components/approvals/hilo-comentarios";
import { exigirSesion, puedeAprobar } from "@/lib/auth/sesion";
import { obtenerPost } from "@/lib/queries/posts";
import { formatearLocal, partesFormulario } from "@/lib/time/asuncion";
import { ETIQUETA_TIPO } from "@/lib/validation/tipos";

export default async function PaginaDetallePost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const datos = await obtenerPost(id, sesion.marcaActiva.id);

  if (!datos) notFound();

  const zona = sesion.marcaActiva.timezone;
  const { fecha, hora } = partesFormulario(
    datos.post.scheduledAt ?? new Date(Date.now() + 3_600_000),
    zona,
  );

  const esAutor = datos.post.autorId === sesion.usuario.id;
  const aprobador = puedeAprobar(sesion);
  const editable =
    datos.post.estado !== "PUBLICADO" &&
    datos.post.estado !== "PUBLICANDO" &&
    datos.post.estado !== "CANCELADO" &&
    !datos.post.archivadoAt;

  const conError = datos.destinos.filter(
    (d) => d.destino.estado === "FALLIDO" && d.destino.errorMensaje,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{datos.post.tituloInterno}</h1>
          <p className="text-sm text-muted-foreground">
            {ETIQUETA_TIPO[datos.post.tipo]} - {datos.autor.nombre} - version{" "}
            {datos.post.version}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <EstadoPostBadge estado={datos.post.estado} />
          {editable && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={"/posts/" + datos.post.id + "/editar"} />}
            >
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {datos.post.scheduledAt && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          {datos.post.estado === "PUBLICADO" ? "Publicada" : "Programada"} para el{" "}
          {formatearLocal(datos.post.scheduledAt, "d 'de' MMMM 'a las' HH:mm", zona)}
        </p>
      )}

      {conError.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            <ul className="space-y-1 text-sm">
              {conError.map((d) => (
                <li key={d.destino.id}>
                  <span className="font-medium">{d.cuenta.nombreVisible}:</span>{" "}
                  {d.destino.errorMensaje}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <AccionesPost
        postId={datos.post.id}
        estado={datos.post.estado}
        esAutor={esAutor}
        puedeAprobar={aprobador}
        zona={zona}
        fechaSugerida={fecha}
        horaSugerida={hora}
      />

      <Separator />

      <div className="flex flex-wrap gap-6">
        {datos.destinos.map((d) => (
          <div key={d.destino.id} className="space-y-2">
            <VistaPrevia
              datos={{
                plataforma: d.destino.plataforma,
                tipo: datos.post.tipo,
                nombreCuenta: d.cuenta.nombreVisible,
                caption: d.destino.caption,
                ubicacion: d.destino.locationNombre,
                medios: datos.medios.map((m) => ({
                  id: m.id,
                  tipo: m.tipo,
                  urlPublica: m.urlPublica,
                })),
                etiquetas: d.etiquetas.map((e) => ({
                  username: e.username,
                  x: e.x != null ? Number(e.x) : null,
                  y: e.y != null ? Number(e.y) : null,
                })),
                primerComentario: d.destino.primerComentario,
                esContenidoIA: d.destino.isAiGenerated,
                tituloTiktok:
                  (d.destino.config as { tiktok?: { titulo?: string } })?.tiktok
                    ?.titulo ?? null,
              }}
            />

            {d.destino.permalink && (
              <a
                href={d.destino.permalink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <ExternalLink className="size-3" />
                Ver publicado
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HiloComentarios
          postId={datos.post.id}
          comentarios={datos.hilo.map((c) => ({
            id: c.comentario.id,
            autor: c.autor.nombre,
            cuerpo: c.comentario.cuerpo,
            fecha: formatearLocal(c.comentario.createdAt, "d/MM HH:mm", zona),
          }))}
        />

        <Card className="p-4">
          <h2 className="text-sm font-medium">Historial de revisiones</h2>
          {datos.historial.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Todavia no la reviso nadie.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {datos.historial.map((h) => (
                <li key={h.aprobacion.id} className="text-sm">
                  <p>
                    <span className="font-medium">{h.revisor.nombre}</span>{" "}
                    {h.aprobacion.accion === "APROBAR"
                      ? "aprobo"
                      : "pidio cambios en"}{" "}
                    la version {h.aprobacion.postVersion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatearLocal(h.aprobacion.createdAt, "d/MM HH:mm", zona)}
                  </p>
                  {h.aprobacion.comentario && (
                    <p className="mt-1 rounded bg-muted p-2 text-xs">
                      {h.aprobacion.comentario}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
