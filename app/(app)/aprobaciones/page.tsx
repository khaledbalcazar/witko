import Link from "next/link";
import { CalendarClock, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VistaPrevia } from "@/components/previews/vista-previa";
import { AccionesPost } from "@/components/approvals/acciones-post";
import { exigirAprobador } from "@/lib/auth/sesion";
import { listarParaRevision, obtenerPost } from "@/lib/queries/posts";
import { formatearLocal, partesFormulario } from "@/lib/time/asuncion";
import { ETIQUETA_TIPO } from "@/lib/validation/tipos";

export const metadata = { title: "Aprobaciones" };

/**
 * Bandeja del Jefe. Ordenada por la fecha programada mas proxima: lo que sale
 * manana se revisa antes que lo que no tiene fecha.
 */
export default async function PaginaAprobaciones() {
  const sesion = await exigirAprobador();
  const zona = sesion.marcaActiva.timezone;
  const pendientes = await listarParaRevision(sesion.marcaActiva.id);

  if (pendientes.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No hay nada esperando revision en {sesion.marcaActiva.nombre}.
      </Card>
    );
  }

  const detalles = await Promise.all(
    pendientes.map((p) => obtenerPost(p.post.id, sesion.marcaActiva.id)),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Esperando tu revision</h1>
        <p className="text-sm text-muted-foreground">
          {pendientes.length}{" "}
          {pendientes.length === 1 ? "publicacion" : "publicaciones"} en{" "}
          {sesion.marcaActiva.nombre}
        </p>
      </div>

      <div className="space-y-6">
        {detalles.map((datos) => {
          if (!datos) return null;

          const { fecha, hora } = partesFormulario(
            datos.post.scheduledAt ?? new Date(Date.now() + 3_600_000),
            zona,
          );

          const esAutor = datos.post.autorId === sesion.usuario.id;

          return (
            <Card key={datos.post.id} className="space-y-4 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0">
                  <Link
                    href={"/posts/" + datos.post.id}
                    className="text-sm font-medium hover:underline"
                  >
                    {datos.post.tituloInterno}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {ETIQUETA_TIPO[datos.post.tipo]} - {datos.autor.nombre} -
                    version {datos.post.version}
                  </p>
                </div>

                <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                  {datos.post.scheduledAt
                    ? formatearLocal(
                        datos.post.scheduledAt,
                        "d 'de' MMMM 'a las' HH:mm",
                        zona,
                      )
                    : "Sin fecha"}
                </p>
              </div>

              {esAutor && !sesion.marcaActiva.permitirAutoAprobacion && (
                <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                  Esta publicacion es tuya, asi que la tiene que revisar otra
                  persona.
                </p>
              )}

              <div className="flex flex-wrap gap-6">
                {datos.destinos.map((d) => (
                  <VistaPrevia
                    key={d.destino.id}
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
                        (d.destino.config as { tiktok?: { titulo?: string } })
                          ?.tiktok?.titulo ?? null,
                    }}
                  />
                ))}
              </div>

              {datos.hilo.length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <MessageSquare className="size-3.5" />
                    Comentarios
                  </p>
                  <ul className="mt-2 space-y-2">
                    {datos.hilo.slice(-3).map((c) => (
                      <li key={c.comentario.id} className="text-xs">
                        <span className="font-medium">{c.autor.nombre}:</span>{" "}
                        {c.comentario.cuerpo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {datos.historial.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ya la revisaron {datos.historial.length}{" "}
                  {datos.historial.length === 1 ? "vez" : "veces"}. La ultima,{" "}
                  {datos.historial[0].revisor.nombre}{" "}
                  {datos.historial[0].aprobacion.accion === "APROBAR"
                    ? "la aprobo"
                    : "pidio cambios"}
                  .
                </p>
              )}

              <AccionesPost
                postId={datos.post.id}
                estado={datos.post.estado}
                esAutor={esAutor}
                puedeAprobar
                zona={zona}
                fechaSugerida={fecha}
                horaSugerida={hora}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
