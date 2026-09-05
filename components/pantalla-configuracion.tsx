import type { VariableFaltante } from "@/lib/auth/configuracion";

/**
 * Pantalla del primer arranque, cuando todavia no hay proyecto de Supabase.
 * Es servidor puro y no toca la base: tiene que poder renderizarse justamente
 * cuando nada esta configurado.
 */
export function PantallaConfiguracion({
  faltantes,
}: {
  faltantes: VariableFaltante[];
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Falta configurar Supabase</h1>
        <p className="text-sm text-muted-foreground">
          La app necesita un proyecto de Supabase para la sesion, la base de
          datos y el almacenamiento de los archivos. Se crea una sola vez, es
          gratis, y toma unos minutos.
        </p>
      </div>

      <ol className="space-y-2 text-sm">
        <li>
          1. Crear un proyecto en{" "}
          <span className="font-mono text-xs">supabase.com/dashboard</span>.
        </li>
        <li>
          2. Crear un bucket <span className="font-mono text-xs">medios</span>{" "}
          en Storage, marcado como publico.
        </li>
        <li>
          3. Copiar los valores de abajo en{" "}
          <span className="font-mono text-xs">.env.local</span> y en{" "}
          <span className="font-mono text-xs">.env</span>.
        </li>
        <li>4. Reiniciar el servidor de desarrollo.</li>
      </ol>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          Faltan {faltantes.length}{" "}
          {faltantes.length === 1 ? "variable" : "variables"}:
        </p>
        <ul className="divide-y rounded-lg border">
          {faltantes.map((v) => (
            <li key={v.nombre} className="p-3">
              <p className="font-mono text-xs font-medium">{v.nombre}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v.donde}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">
        Despues corre{" "}
        <span className="font-mono text-xs">
          npm run db:migrate &amp;&amp; npm run db:seed
        </span>{" "}
        para crear las tablas y las marcas. El paso a paso completo, incluido el
        primer usuario administrador, esta en SETUP.md.
      </p>
    </main>
  );
}
