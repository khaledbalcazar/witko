"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface EnlaceNav {
  href: string;
  etiqueta: string;
  icono: LucideIcon;
  insignia?: number;
}

export function NavPrincipal({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="space-y-1">
      {enlaces.map((e) => {
        const activo =
          e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);

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
            <e.icono className="size-4" />
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
