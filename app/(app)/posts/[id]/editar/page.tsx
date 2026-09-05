import { notFound } from "next/navigation";
import { FormularioPost } from "@/components/post-form/formulario-post";
import { EstadoPostBadge } from "@/components/estado/estado-post";
import { exigirSesion } from "@/lib/auth/sesion";
import { listarCuentas, obtenerPost } from "@/lib/queries/posts";
import { partesFormulario } from "@/lib/time/asuncion";
import type { EstadoFormulario } from "@/components/post-form/estado";

export const metadata = { title: "Editar publicacion" };

export default async function PaginaEditarPublicacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await exigirSesion();
  const datos = await obtenerPost(id, sesion.marcaActiva.id);

  if (!datos) notFound();

  const cuentas = await listarCuentas(sesion.marcaActiva.id);
  const zona = sesion.marcaActiva.timezone;

  const referencia = datos.post.scheduledAt ?? new Date(Date.now() + 3_600_000);
  const { fecha, hora } = partesFormulario(referencia, zona);

  const captions = new Set(datos.destinos.map((d) => d.destino.caption));

  const inicial: EstadoFormulario = {
    postId: datos.post.id,
    tituloInterno: datos.post.tituloInterno,
    tipo: datos.post.tipo,
    cuentasElegidas: datos.destinos.map((d) => d.destino.socialAccountId),
    medios: datos.medios.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      urlPublica: m.urlPublica,
      mime: m.mime,
      bytes: m.bytes,
      ancho: m.ancho,
      alto: m.alto,
      duracionMs: m.duracionMs,
    })),
    destinos: datos.destinos.map((d) => ({
      socialAccountId: d.destino.socialAccountId,
      plataforma: d.destino.plataforma,
      caption: d.destino.caption,
      primerComentario: d.destino.primerComentario,
      altText: d.destino.altText,
      isAiGenerated: d.destino.isAiGenerated,
      locationId: d.destino.locationId,
      locationNombre: d.destino.locationNombre,
      config: (d.destino.config ?? {}) as EstadoFormulario["destinos"][number]["config"],
      etiquetas: d.etiquetas.map((e) => ({
        mediaAssetId: e.mediaAssetId,
        username: e.username,
        x: e.x != null ? Number(e.x) : null,
        y: e.y != null ? Number(e.y) : null,
      })),
    })),
    // Si todos los destinos tienen el mismo texto, se asume que estaba unificado.
    captionUnificado: captions.size <= 1,
    captionBase: datos.destinos[0]?.destino.caption ?? "",
    fecha,
    hora,
    modoPublicacion: datos.post.scheduledAt ? "PROGRAMAR" : "SIN_FECHA",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{datos.post.tituloInterno}</h1>
        <EstadoPostBadge estado={datos.post.estado} />
      </div>

      <FormularioPost
        cuentas={cuentas.map((c) => ({
          id: c.id,
          plataforma: c.plataforma,
          nombreVisible: c.nombreVisible,
        }))}
        estadoPost={datos.post.estado}
        zona={zona}
        inicial={inicial}
      />
    </div>
  );
}
