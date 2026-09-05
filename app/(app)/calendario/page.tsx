import { Calendario } from "@/components/calendar/calendario";
import { exigirSesion, puedeAprobar } from "@/lib/auth/sesion";
import { listarMiembros, listarPosts } from "@/lib/queries/posts";

export const metadata = { title: "Calendario" };

export default async function PaginaCalendario() {
  const sesion = await exigirSesion();

  // Se traen todas las que tienen fecha; el filtrado por estado, plataforma y
  // autor se hace en el cliente para que cambiar un filtro sea instantaneo.
  const publicaciones = await listarPosts(sesion.marcaActiva.id, { limite: 500 });
  const miembros = await listarMiembros(sesion.marcaActiva.id);

  return (
    <Calendario
      zona={sesion.marcaActiva.timezone}
      puedeMover={puedeAprobar(sesion) || true}
      autores={miembros.map((m) => ({ id: m.id, nombre: m.nombre }))}
      publicaciones={publicaciones
        .filter((p) => p.post.scheduledAt != null)
        .map((p) => ({
          id: p.post.id,
          titulo: p.post.tituloInterno,
          estado: p.post.estado,
          autorId: p.autor.id,
          autor: p.autor.nombre,
          scheduledAt: p.post.scheduledAt!.toISOString(),
          plataformas: [...new Set(p.destinos.map((d) => d.plataforma))],
        }))}
    />
  );
}
