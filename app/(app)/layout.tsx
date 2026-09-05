import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exigirSesion, puedeAprobar } from "@/lib/auth/sesion";
import { contarPendientesDeRevision } from "@/lib/workflow/apply";
import { SelectorDeMarca } from "@/components/shell/selector-de-marca";
import { MenuUsuario } from "@/components/shell/menu-usuario";
import { NavMovil, NavPrincipal } from "@/components/shell/nav-principal";
import type { EnlaceNav } from "@/components/shell/iconos-nav";
import { PantallaConfiguracion } from "@/components/pantalla-configuracion";
import { variablesFaltantes } from "@/lib/auth/configuracion";

/**
 * Nada de lo que cuelga de este layout se puede prerenderizar: todo depende de
 * quien inicio sesion y de la marca activa, que viven en cookies. Sin esto,
 * `next build` intenta generarlas como estaticas y falla al no encontrar
 * sesion ni base de datos.
 */
export const dynamic = "force-dynamic";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  // Antes de tocar la sesion: sin configuracion no hay nada que consultar, y
  // un stack trace de Supabase no le dice a nadie que le falta un .env.
  const faltantes = variablesFaltantes();
  if (faltantes.length > 0) {
    return <PantallaConfiguracion faltantes={faltantes} />;
  }

  const sesion = await exigirSesion();
  const aprobador = puedeAprobar(sesion);
  const pendientes = aprobador
    ? await contarPendientesDeRevision(sesion.marcaActiva.id)
    : 0;

  // Los iconos van como clave, no como componente: las funciones no cruzan la
  // frontera entre Server y Client Components.
  const enlaces: EnlaceNav[] = [
    { href: "/", etiqueta: "Inicio", icono: "inicio" },
    { href: "/tablero", etiqueta: "Tablero", icono: "tablero" },
    { href: "/calendario", etiqueta: "Calendario", icono: "calendario" },
    ...(aprobador
      ? [
          {
            href: "/aprobaciones",
            etiqueta: "Aprobaciones",
            icono: "aprobaciones" as const,
            insignia: pendientes,
          },
        ]
      : []),
    ...(sesion.usuario.rol === "ADMIN"
      ? [
          {
            href: "/admin/cuentas",
            etiqueta: "Administracion",
            icono: "administracion" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Publicaciones
          </Link>

          <SelectorDeMarca
            marcas={sesion.marcas}
            marcaActivaId={sesion.marcaActiva.id}
          />

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" render={<Link href="/posts/nueva" />}>
              <Plus className="size-4" />
              Nueva publicacion
            </Button>
            <MenuUsuario
              nombre={sesion.usuario.nombre}
              email={sesion.usuario.email}
              rol={sesion.marcaActiva.rolEnMarca}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r p-3 md:block">
          <NavPrincipal enlaces={enlaces} />
          <div className="mt-6 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Modo de prueba</p>
            <p className="mt-1">
              Las publicaciones no salen a las redes todavia: el sistema simula
              la publicacion hasta que Meta y TikTok aprueben las apps.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>

      <NavMovil enlaces={enlaces} />
    </div>
  );
}
