import type { VariableFaltante } from "@/lib/auth/configuracion";

/**
 * Pantalla del primer arranque, cuando faltan variables de entorno.
 * Es servidor puro y no toca la base: tiene que poder renderizarse justamente
 * cuando nada esta configurado.
 */
export function PantallaConfiguracion({
  faltantes,
}: {
  faltantes: VariableFaltante[];
}) {
  // En un despliegue las variables se cargan en el panel del proveedor, no en
  // un archivo: dar los pasos de local ahi solo confunde.
  const desplegada = process.env.VERCEL === "1";

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Falta configurar Supabase</h1>
        <p className="text-sm text-muted-foreground">
          La app necesita un proyecto de Supabase para la sesion, la base de
          datos y el almacenamiento de los archivos.
        </p>
      </div>

      {desplegada ? (
        <ol className="space-y-2 text-sm">
          <li>
            1. En Vercel, abrir <strong>Settings</strong> y despues{" "}
            <strong>Environment Variables</strong>.
          </li>
          <li>2. Cargar las variables de abajo.</li>
          <li>
            3. Volver a desplegar desde <strong>Deployments</strong>, en el menu
            del ultimo despliegue, <strong>Redeploy</strong>. Las variables no se
            aplican solas a un despliegue ya hecho.
          </li>
        </ol>
      ) : (
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
      )}

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

      {desplegada ? (
        <p className="text-sm text-muted-foreground">
          Ojo con <span className="font-mono text-xs">DATABASE_URL</span>: en un
          entorno sin servidor hay que usar la cadena del{" "}
          <strong>transaction pooler</strong> (
          <span className="font-mono text-xs">...pooler.supabase.com:6543</span>
          ), no la conexion directa, que agota el limite de conexiones. Y{" "}
          <span className="font-mono text-xs">TOKEN_ENCRYPTION_KEY</span> tiene
          que ser la misma que usa el worker.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Despues corre{" "}
          <span className="font-mono text-xs">
            npm run db:migrate &amp;&amp; npm run db:seed
          </span>{" "}
          para crear las tablas y las marcas. El paso a paso completo, incluido
          el primer usuario administrador, esta en SETUP.md.
        </p>
      )}
    </main>
  );
}
