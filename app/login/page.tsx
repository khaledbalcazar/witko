import { FormularioLogin } from "./formulario";

export const metadata = { title: "Ingresar" };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
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
