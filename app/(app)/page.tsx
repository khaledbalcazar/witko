import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EstadoPostBadge } from "@/components/estado/estado-post";
import { exigirSesion, puedeAprobar } from "@/lib/auth/sesion";
import { listarParaRevision, listarPosts } from "@/lib/queries/posts";
import { formatearLocal } from "@/lib/time/asuncion";

export default async function PaginaInicio() {
  const sesion = await exigirSesion();
  const zona = sesion.marcaActiva.timezone;
  const aprobador = puedeAprobar(sesion);

  const [proximas, mias, pendientes, conProblemas] = await Promise.all([
    listarPosts(sesion.marcaActiva.id, {
      estados: ["PROGRAMADO"],
      desde: new Date(),
      limite: 5,
    }),
    listarPosts(sesion.marcaActiva.id, {
      autorId: sesion.usuario.id,
      estados: ["BORRADOR", "CAMBIOS_SOLICITADOS"],
      limite: 5,
    }),
    aprobador ? listarParaRevision(sesion.marcaActiva.id) : Promise.resolve([]),
    listarPosts(sesion.marcaActiva.id, { estados: ["FALLIDO"], limite: 5 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">
          Hola, {sesion.usuario.nombre.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Estas trabajando en {sesion.marcaActiva.nombre}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {aprobador && (
          <Bloque
            titulo="Esperan tu revision"
            vacio="Nada pendiente por ahora."
            verMas="/aprobaciones"
            items={pendientes.slice(0, 5).map((p) => ({
              id: p.post.id,
              titulo: p.post.tituloInterno,
              detalle: p.autor.nombre,
              estado: p.post.estado,
            }))}
          />
        )}

        <Bloque
          titulo="Tus borradores"
          vacio="No tenes nada a medio hacer."
          verMas="/posts"
          items={mias.map((p) => ({
            id: p.post.id,
            titulo: p.post.tituloInterno,
            detalle:
              p.post.estado === "CAMBIOS_SOLICITADOS"
                ? "Te pidieron cambios"
                : "Borrador",
            estado: p.post.estado,
          }))}
        />

        <Bloque
          titulo="Proximas a salir"
          vacio="No hay nada programado."
          verMas="/calendario"
          items={proximas.map((p) => ({
            id: p.post.id,
            titulo: p.post.tituloInterno,
            detalle: p.post.scheduledAt
              ? formatearLocal(p.post.scheduledAt, "d 'de' MMMM 'a las' HH:mm", zona)
              : "",
            estado: p.post.estado,
          }))}
        />

        {conProblemas.length > 0 && (
          <Bloque
            titulo="Fallaron al publicar"
            vacio=""
            verMas="/posts"
            items={conProblemas.map((p) => ({
              id: p.post.id,
              titulo: p.post.tituloInterno,
              detalle: "Revisa el error y reintenta",
              estado: p.post.estado,
            }))}
          />
        )}
      </div>
    </div>
  );
}

function Bloque({
  titulo,
  vacio,
  verMas,
  items,
}: {
  titulo: string;
  vacio: string;
  verMas: string;
  items: Array<{
    id: string;
    titulo: string;
    detalle: string;
    estado: Parameters<typeof EstadoPostBadge>[0]["estado"];
  }>;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{titulo}</h2>
        <Link href={verMas} className="text-xs text-muted-foreground hover:underline">
          Ver todo
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={"/posts/" + item.id}
                className="flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detalle}
                  </span>
                </span>
                <EstadoPostBadge estado={item.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
