"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ICONOS_NAV, type EnlaceNav } from "./iconos-nav";

export type { EnlaceNav };

export function NavPrincipal({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="space-y-1">
      {enlaces.map((e) => {
        const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        const Icono = ICONOS_NAV[e.icono];

        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              activo
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icono className="size-4" />
            {e.etiqueta}
            {e.insignia ? (
              <Badge variant="secondary" className="ml-auto">
                {e.insignia}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior de movil. Comparte los mismos enlaces que la lateral. */
export function NavMovil({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t bg-background md:hidden">
      {enlaces.map((e) => {
        const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
        const Icono = ICONOS_NAV[e.icono];

        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px]",
              activo ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Icono className="size-5" />
            <span className="flex items-center gap-1">
              {e.etiqueta}
              {e.insignia ? (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {e.insignia}
                </Badge>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
