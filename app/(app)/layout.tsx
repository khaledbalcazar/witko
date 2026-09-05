import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  KanbanSquare,
  LayoutDashboard,
  Plus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exigirSesion, puedeAprobar } from "@/lib/auth/sesion";
import { contarPendientesDeRevision } from "@/lib/workflow/apply";
import { SelectorDeMarca } from "@/components/shell/selector-de-marca";
import { MenuUsuario } from "@/components/shell/menu-usuario";
import { NavPrincipal } from "@/components/shell/nav-principal";

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await exigirSesion();
  const aprobador = puedeAprobar(sesion);
  const pendientes = aprobador
    ? await contarPendientesDeRevision(sesion.marcaActiva.id)
    : 0;

  const enlaces = [
    { href: "/", etiqueta: "Inicio", icono: LayoutDashboard },
    { href: "/tablero", etiqueta: "Tablero", icono: KanbanSquare },
    { href: "/calendario", etiqueta: "Calendario", icono: CalendarDays },
    ...(aprobador
      ? [
          {
            href: "/aprobaciones",
            etiqueta: "Aprobaciones",
            icono: CheckCircle2,
            insignia: pendientes,
          },
        ]
      : []),
    ...(sesion.usuario.rol === "ADMIN"
      ? [{ href: "/admin/cuentas", etiqueta: "Administracion", icono: Settings }]
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

      <nav className="sticky bottom-0 flex border-t bg-background md:hidden">
        {enlaces.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
          >
            <e.icono className="size-5" />
            <span className="flex items-center gap-1">
              {e.etiqueta}
              {"insignia" in e && e.insignia ? (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {e.insignia}
                </Badge>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
