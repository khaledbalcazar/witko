import { Card } from "@/components/ui/card";
import { Tablero } from "@/components/board/tablero";
import { exigirSesion } from "@/lib/auth/sesion";
import { obtenerTablero } from "@/lib/queries/tablero";
import { listarMiembros, listarPosts } from "@/lib/queries/posts";

export const metadata = { title: "Tablero" };

export default async function PaginaTablero() {
  const sesion = await exigirSesion();
  const datos = await obtenerTablero(sesion.marcaActiva.id);

  if (!datos) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Esta marca todavia no tiene tablero. Corre <code>npm run db:seed</code>{" "}
        para crear el que viene por defecto.
      </Card>
    );
  }

  const [miembros, publicaciones] = await Promise.all([
    listarMiembros(sesion.marcaActiva.id),
    listarPosts(sesion.marcaActiva.id, { limite: 200 }),
  ]);

  return (
    <Tablero
      boardId={datos.tablero.id}
      nombre={datos.tablero.nombre}
      zona={sesion.marcaActiva.timezone}
      usuarioId={sesion.usuario.id}
      columnas={datos.columnas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        color: c.color,
        orden: c.orden,
      }))}
      etiquetas={datos.etiquetas.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        color: e.color,
      }))}
      miembros={miembros.map((m) => ({ id: m.id, nombre: m.nombre }))}
      publicaciones={publicaciones.map((p) => ({
        id: p.post.id,
        titulo: p.post.tituloInterno,
        estado: p.post.estado,
      }))}
      tarjetas={datos.tarjetas.map((t) => ({
        id: t.id,
        columnId: t.columnId,
        orden: t.orden,
        titulo: t.titulo,
        descripcion: t.descripcion,
        prioridad: t.prioridad,
        dueAt: t.dueAt?.toISOString() ?? null,
        completadoAt: t.completadoAt?.toISOString() ?? null,
        asignadoId: t.asignadoId,
        asignadoNombre: t.asignado?.nombre ?? null,
        postId: t.postId,
        postTitulo: t.post?.titulo ?? null,
        postEstado: t.post?.estado ?? null,
        etiquetaIds: t.etiquetaIds,
        checklist: t.checklist.map((i) => ({
          id: i.id,
          texto: i.texto,
          hecho: i.hecho,
        })),
        comentarios: t.comentarios.map((c) => ({
          id: c.id,
          cuerpo: c.cuerpo,
          autorId: c.autorId,
          autorNombre: c.autorNombre,
          createdAt: c.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
