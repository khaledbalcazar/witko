import { FormularioPost } from "@/components/post-form/formulario-post";
import { exigirSesion } from "@/lib/auth/sesion";
import { listarCuentas } from "@/lib/queries/posts";
import { partesFormulario } from "@/lib/time/asuncion";

export const metadata = { title: "Nueva publicacion" };

export default async function PaginaNuevaPublicacion() {
  const sesion = await exigirSesion();
  const cuentas = await listarCuentas(sesion.marcaActiva.id);
  const { fecha, hora } = partesFormulario(
    new Date(Date.now() + 60 * 60 * 1000),
    sesion.marcaActiva.timezone,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Nueva publicacion</h1>
        <p className="text-sm text-muted-foreground">
          {sesion.marcaActiva.nombre}
        </p>
      </div>

      <FormularioPost
        cuentas={cuentas.map((c) => ({
          id: c.id,
          plataforma: c.plataforma,
          nombreVisible: c.nombreVisible,
        }))}
        estadoPost={null}
        zona={sesion.marcaActiva.timezone}
        inicial={{
          postId: null,
          tituloInterno: "",
          tipo: null,
          cuentasElegidas: [],
          medios: [],
          destinos: [],
          captionUnificado: true,
          captionBase: "",
          fecha,
          hora,
          modoPublicacion: "SIN_FECHA",
        }}
      />
    </div>
  );
}
