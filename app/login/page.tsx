import { PantallaConfiguracion } from "@/components/pantalla-configuracion";
import { variablesFaltantes } from "@/lib/auth/configuracion";
import { FormularioLogin } from "./formulario";

export const metadata = { title: "Ingresar" };

/**
 * Se evalua en cada visita, no en el build: el chequeo de configuracion mira
 * el entorno de ejecucion, y prerenderizarla congelaria el resultado del
 * momento en que se compilo.
 */
export const dynamic = "force-dynamic";

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  // El login es la otra puerta de entrada: si no hay configuracion, tampoco
  // tiene sentido mostrar un formulario que no va a poder autenticar a nadie.
  const faltantes = variablesFaltantes();
  if (faltantes.length > 0) {
    return <PantallaConfiguracion faltantes={faltantes} />;
  }

  const { volver } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Publicaciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa con el correo y la contrasena que te dio el administrador.
          </p>
        </div>
        <FormularioLogin volver={volver ?? "/"} />
      </div>
    </main>
  );
}
