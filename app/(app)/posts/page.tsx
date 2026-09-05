import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EstadoPostBadge } from "@/components/estado/estado-post";
import { exigirSesion } from "@/lib/auth/sesion";
import { listarPosts } from "@/lib/queries/posts";
import { formatearCorto } from "@/lib/time/asuncion";
import { ETIQUETA_PLATAFORMA, ETIQUETA_TIPO } from "@/lib/validation/tipos";

export const metadata = { title: "Publicaciones" };

export default async function PaginaPosts() {
  const sesion = await exigirSesion();
  const publicaciones = await listarPosts(sesion.marcaActiva.id);
  const zona = sesion.marcaActiva.timezone;

  if (publicaciones.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Todavia no hay publicaciones en {sesion.marcaActiva.nombre}.{" "}
        <Link href="/posts/nueva" className="underline">
          Crea la primera
        </Link>
        .
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Publicaciones</h1>

      <ul className="divide-y rounded-lg border">
        {publicaciones.map(({ post, autor, destinos, portada }) => (
          <li key={post.id}>
            <Link
              href={"/posts/" + post.id}
              className="flex items-center gap-4 p-3 transition-colors hover:bg-accent/40"
            >
              <div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
                {portada?.urlPublica ? (
                  portada.tipo === "VIDEO" ? (
                    <video
                      src={portada.urlPublica}
                      className="size-full object-cover"
                      muted
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portada.urlPublica}
                      alt=""
                      className="size-full object-cover"
                    />
                  )
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {post.tituloInterno}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {ETIQUETA_TIPO[post.tipo]} - {autor.nombre} -{" "}
                  {destinos
                    .map((d) => ETIQUETA_PLATAFORMA[d.plataforma])
                    .join(", ")}
                </p>
              </div>

              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                {post.scheduledAt ? formatearCorto(post.scheduledAt, zona) : "Sin fecha"}
              </div>

              <EstadoPostBadge estado={post.estado} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
